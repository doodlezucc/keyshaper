/** @type {AudioContext} */
let ctx;

const sourcesContainer = document.querySelector("#sources");
const effectsContainer = document.querySelector("#effects");

let sourceLookup = {
    "oscillator": () => new Oscillator(),
    "drumpad": () => new DrumPad(),
};

class ControlsWindow {
    constructor(templateId, parent) {
        /** @type {HTMLTemplateElement} */
        const template = document.getElementById(templateId);
        this.elem = document.createElement("div");
        this.elem.className = 'window ' + templateId;

        for (const child of template.content.children) {
            this.elem.append(child.cloneNode(true));
        }

        parent.append(this.elem);
    }
}

class AudioSourceControls extends ControlsWindow {
    constructor(templateId) {
        super(templateId, sourcesContainer);
    }
}
class EffectControls extends ControlsWindow {
    constructor(templateId) {
        super(templateId, effectsContainer);
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

class AudioSource {
    constructor(templateId) {
        this.type = templateId;
        this.controls = new AudioSourceControls(templateId);

        this.gain = ctx.createGain();
        this.gain.gain.value = 0.2;
        this.gain.connect(project.effectChain.chainStart);

        /** @type {PlayingNote[]} */
        this.notes = [];
        this.pitchBend = 0;
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
            if (!project.patterns.length) {
                project.patterns.push(new Pattern(0, 1));
            }
            project.patterns[project.currentPattern].registerNote(note, velocity, when);
        }
    }

    _noteOff(note, when, doRecord) {
        if (this.notes[note]) {
            this.notes[note].end(when);
            this.notes[note] = null;
        }

        if (doRecord && !project.isPaused) {
            project.patterns[project.currentPattern].finishRegisteringNote(note, when);
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

    toJson() {
        return {
            "type": this.type,
            "params": this.paramsToJson(),
        };
    }

    static fromJson(j) {
        const type = j["type"];
        const obj = sourceLookup[type]();
        obj.paramsFromJson(j["params"]);
        return obj;
    }

    paramsToJson() {
        return {};
    }

    paramsFromJson(j) { }

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

class AudioEffect extends NodeChain {
    constructor(type, effectChain) {
        super(effectChain.chainStart, effectChain.chainEnd);
        this.type = type;
        this.controls = new EffectControls(type);

        /** @type {NodeChain} */
        this.effectChain = effectChain;
    }
}

class EffectChain extends NodeChain {
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
            if (this.effects.length) {
                this.chainEnd.disconnect(this.effects[index - 1]);
            }
            effect.chainEnd.connect(this.chainEnd);
        } else if (index > 0) {
            effect.chainEnd.connect(this.effects[index].chainStart);
        }

        this.effects.splice(index, 0, effect);
    }
}