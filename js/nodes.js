/** @type {AudioContext} */
let ctx;

const controlsContainer = document.querySelector("#controls");

class AudioSourceControls {
    constructor(templateId) {
        /**
         * @type {HTMLTemplateElement}
         */
        const template = document.getElementById(templateId);
        this.elem = document.createElement("div");
        this.elem.className = 'window ' + templateId;

        for (const child of template.content.children) {
            this.elem.append(child.cloneNode(true));
        }

        controlsContainer.append(this.elem);
    }
}

class PlayingNote {
    /**
     * @param {AudioNode} chainEnd
     * @param {function(number)} [onPitchBend]
     * @param {function()} [onRelease]
     */
    constructor(chainEnd, onPitchBend, onRelease) {
        this.chainEnd = chainEnd;
        this.onPitchBend = onPitchBend;
        this.onRelease = onRelease;
    }

    end() {
        if (!this.onRelease) {
            this.chainEnd.disconnect();
        } else {
            this.onRelease();
        }
    }
}

class AudioSource {
    constructor(templateId) {
        this.controls = new AudioSourceControls(templateId);

        this.gain = ctx.createGain();
        this.gain.gain.value = 0.2;
        this.gain.connect(ctx.destination);

        /** @type {PlayingNote[]} */
        this.notes = [];
        this.pitchBend = 0;
    }

    midi(ev) {
        const type = ev[0];
        const note = ev[1];
        switch (type) {
            case 144:
                return this._noteOn(note, ev[2]);
            case 128:
                return this._noteOff(note);
            case 224:
                return this._pitchBend(ev[2] / 63.5 - 1);
        }
    }

    onBlur() {
        this._pitchBend(0);
        for (const note of this.notes) {
            if (note) {
                note.end();
            }
        }
        this.notes = [];
    }

    _pitchBend(amount) {
        this.pitchBend = amount;
        for (const note of this.notes) {
            if (note) {
                note.onPitchBend(amount);
            }
        }
    }

    _noteOn(note, velocity) {
        if (this.notes[note]) {
            // Already playing
            this._noteOff(note);
        }
        const player = this.createNotePlayer(note, velocity, this.gain);
        if (player) {
            player.onPitchBend(this.pitchBend);
            player.chainEnd.connect(this.gain);
            this.notes[note] = player;
        }

    }

    _noteOff(note) {
        if (this.notes[note]) {
            this.notes[note].end();
            this.notes[note] = null;
        }
    }

    /**
     * @param {number} note
     * @param {number} velocity
     * @returns {PlayingNote}
     */
    createNotePlayer(note, velocity) {
        console.error("Unhandled note player creation!");
        return null;
    }
}

function midiToFrequency(note) {
    return 440 * Math.pow(2, (note - 69) / 12);
}