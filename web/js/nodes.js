/** @type {BaseAudioContext} */
let ctx;

const sourcesContainer = document.querySelector("#sources");
const effectsContainer = document.querySelector("#effects");

let sourceLookup = {};
let effectLookup = {};

function registerSource(id, call) {
    sourceLookup[id] = call;
}
function registerEffect(id, call) {
    effectLookup[id] = call;
}

class ControlsWindow {
    constructor(templateId, name, parent) {
        this.elem = document.createElement("div");
        this.elem.className = 'window ' + templateId;

        const span = document.createElement("span");
        const title = document.createElement("p");
        title.innerText = name;
        span.appendChild(title);

        this.content = document.createElement("content");

        /** @type {HTMLTemplateElement} */
        const template = document.getElementById(templateId);
        for (const child of template.content.children) {
            this.content.append(child.cloneNode(true));
        }

        this.elem.append(span, this.content);

        if (!project.isRendering) {
            parent.append(this.elem);
        }
    }
}

class AudioSourceControls extends ControlsWindow {
    constructor(templateId, name) {
        super(templateId, name, sourcesContainer);

        this.busInput = document.createElement("input");
        this.busInput.type = "number";
        this.busInput.min = -1;
        this.busInput.max = 3;
        this.elem.children[0].append(this.busInput);
    }
}
class EffectControls extends ControlsWindow {
    constructor(templateId, name) {
        super(templateId, name, effectsContainer);
    }

    updateTrack(index) {
        this.elem.setAttribute("track", index);
    }
}

class PlayingNote {
    /**
     * @param {AudioNode} chainEnd
     * @param {function(number)} [onPitchBend]
     * @param {function():Promise} [onRelease]
     */
    constructor(chainEnd, onPitchBend, onRelease) {
        this.chainEnd = chainEnd;
        this.onPitchBend = onPitchBend;
        this.onRelease = onRelease;
    }

    async end(when) {
        if (this.onRelease) {
            await this.onRelease(when);
        }
        this.chainEnd.disconnect();
    }
}

class SerializableParams {
    constructor(type) {
        this.type = type;
    }

    toJson() {
        return {
            "type": this.type,
            "params": this.paramsToJson(),
        };
    }

    static fromJson(j) {
        const type = j["type"];
        let call = sourceLookup[type];
        if (!call) {
            call = effectLookup[type];
        }
        const obj = call();
        obj.paramsFromJson(j["params"]);
        return obj;
    }

    paramsToJson() { return {}; }
    paramsFromJson(j) { }

    async preloadAllResources() { }
}

class AudioSource extends SerializableParams {
    #bus;

    constructor(templateId, name) {
        super(templateId);
        this.controls = new AudioSourceControls(templateId, name);

        this.gain = ctx.createGain();
        this.gain.gain.value = 0.2;
        this.bus = project.mixer.selectedIndex;
        this.controls.busInput.oninput = () => {
            this.bus = this.controls.busInput.valueAsNumber;
        }

        /** @type {PlayingNote[]} */
        this.notes = [];
        this.pitchBend = 0;
    }

    get bus() { return this.#bus; }
    set bus(index) {
        this.#bus = index;
        this.controls.busInput.value = index;
        this.gain.disconnect();
        this.gain.connect(project.mixer.trackAt(index).chainStart);
    }

    toJson() {
        return {
            "bus": this.bus,
            ...super.toJson()
        };
    }

    static fromJson(j) {
        /** @type {AudioSource} */
        const serialized = super.fromJson(j);
        serialized.bus = j["bus"] ?? -1;
        return serialized;
    }

    midi(ev) {
        const type = ev[0];
        const note = ev[1];
        switch (type) {
            case 144:
                return this._noteOn(note, ev[2] / 127, ctx.currentTime, project.isRecording);
            case 128:
                return this._noteOff(note, ctx.currentTime, project.isRecording);
            case 224:
                return this._pitchBend(ev[2] / 63.5 - 1, project.isRecording);
        }
    }

    onBlur(when) {
        this._pitchBend(0);
        for (const note of this.notes) {
            if (note) {
                note.end(when);
            }
        }
        this.notes = [];
    }

    _pitchBend(amount) {
        this.pitchBend = amount;
        for (const note of this.notes) {
            if (note && note.onPitchBend) {
                note.onPitchBend(amount);
            }
        }
    }

    _noteOn(note, velocity, when, doRecord) {
        if (this.notes[note]) {
            // Already playing
            this._noteOff(note, when);
        }
        const player = this.createNotePlayer(note, velocity, when);
        if (player) {
            player.onPitchBend(this.pitchBend);
            player.chainEnd.connect(this.gain);
            this.notes[note] = player;
        }

        if (doRecord && !project.isPaused) {
            if (!project.timelineItems.length) {
                project.activeLoop.patterns.push(new Pattern(0, 1));
                project.activeLoop.updateLongestItem();
            }
            project.activeLoop.patterns[project.activeLoop.currentItem].registerNote(note, velocity, when);
        }
    }

    _noteOff(note, when, doRecord) {
        if (this.notes[note]) {
            this.notes[note].end(when);
            this.notes[note] = null;
        }

        if (doRecord && !project.isPaused) {
            project.activeLoop.patterns[project.activeLoop.currentItem].finishRegisteringNote(note, when);
        }
    }

    /**
     * @param {number} note
     * @param {number} velocity
     * @returns {PlayingNote}
     */
    createNotePlayer(note, velocity, when) {
        console.error("Unhandled note player creation!");
        return null;
    }

    dispose() {
        this.onBlur(ctx.currentTime);
        this.gain.disconnect();
        this.controls.elem.remove();
    }
}

function midiToFrequency(note) {
    return 440 * Math.pow(2, (note - 69) / 12);
}

function registerInput(inp, cb) {
    inp.oninput = () => cb(inp.valueAsNumber);
}

class NodeChain {
    constructor(chainStart, chainEnd) {
        /** @type {AudioNode} */
        this.chainStart = chainStart;
        /** @type {AudioNode} */
        this.chainEnd = chainEnd;
    }
}

class AudioEffect extends SerializableParams {
    /** @param {NodeChain} effectChain */
    constructor(type, name, effectChain) {
        super(type);
        this.effectChain = effectChain;
        this.chainStart = effectChain.chainStart;
        this.chainEnd = effectChain.chainEnd;
        this.controls = new EffectControls(type, name);
        this.controls.elem.onmousedown = (ev) => {
            if (ev.button == 1) {
                const myTrack = project.mixer.allTracks.find(t => t.effects.some(fx => fx == this));
                myTrack.remove(this);
            }
        }
    }

    dispose() {
        this.controls.elem.remove();
    }
}

class EffectRack extends NodeChain {
    constructor() {
        super(ctx.createGain(), ctx.createGain());

        /** @type {AudioEffect[]} */
        this.effects = [];
        this.chainStart.connect(this.chainEnd);
    }

    /**
     * @param {AudioEffect} effect
     * @param {number} index
     */
    insert(effect, index) {
        if (index == 0) {
            if (this.effects.length) {
                this.chainStart.disconnect(this.effects[0]);
            } else {
                this.chainStart.disconnect(this.chainEnd);
            }
            this.chainStart.connect(effect.chainStart);
        } else {
            this.effects[index - 1].chainEnd.disconnect(0);
            this.effects[index - 1].chainEnd.connect(effect.chainStart);
        }

        if (index == this.effects.length) {
            effect.chainEnd.connect(this.chainEnd);
        } else if (index > 0) {
            effect.chainEnd.connect(this.effects[index].chainStart);
        }

        this.effects.splice(index, 0, effect);
    }

    /**
     * @param {AudioEffect} effect
     */
    remove(effect) {
        const index = this.effects.indexOf(effect);
        if (index < 0) return;

        effect.dispose();

        const previous = index == 0 ? this.chainStart : this.effects[index - 1].chainEnd;
        const next = index + 1 == this.effects.length ? this.chainEnd : this.effects[index + 1].chainStart;

        previous.disconnect();
        effect.chainEnd.disconnect();
        previous.connect(next);

        this.effects.splice(index, 1);
    }

    append(effect) {
        this.insert(effect, this.effects.length);
    }
}