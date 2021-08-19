const controlsContainer = document.querySelector("#controls");

class AudioSourceControls {
    constructor(templateId) {
        const template = document.querySelector("#" + templateId);
        this.elem = document.createElement("div");

        for (const child of template.children) {
            this.elem.append(document.cloneNode(child));
        }

        controlsContainer.append(this.elem);
    }
}

class PlayingNote {
    /**
     * @param {number} note 
     * @param {number} velocity 
     * @param {AudioNode} chainEnd 
     */
    constructor(note, velocity, chainEnd) {
        this.note = note;
        this.velocity = velocity;
        this.chainEnd = chainEnd;
    }

    end() {
        this.chainEnd.disconnect();
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
    }

    midi(ev) {
        const type = ev[0];
        const note = ev[1];
        switch (type) {
            case 144:
                return this._noteOn(note, ev[2]);
            case 128:
                return this._noteOff(note);
        }
    }

    _noteOn(note, velocity) {
        if (this.notes[note]) {
            // Already playing
            this._noteOff(note);
        }
        const player = this.createNotePlayer(note, velocity, this.gain);
        this.notes[note] = new PlayingNote(note, velocity, player);

    }

    _noteOff(note) {
        if (this.notes[note]) {
            this.notes[note].end();
            this.notes[note] = null;
        }
    }

    createNotePlayer(note, velocity, destination) {
        console.error("Unhandled note player creation!");
    }
}

class Oscillator extends AudioSource {
    constructor() {
        super("oscillator");
        this.type = "square";
        this.attack = 0;
        //this.hold = 0;
        this.decay = 0.1;
        this.sustain = 0.6;
        this.release = 1;
    }

    createNotePlayer(note, velocity, destination) {
        //console.log("osci play " + note + " " + velocity);

        const osc = ctx.createOscillator();
        osc.type = this.type;
        osc.frequency.value = midiToFrequency(note);

        const noteGain = ctx.createGain();
        const max = velocity / 127;
        noteGain.gain.setValueAtTime(0, ctx.currentTime);
        noteGain.gain.linearRampToValueAtTime(max, ctx.currentTime + this.attack);
        noteGain.gain.linearRampToValueAtTime(max * this.sustain, ctx.currentTime + this.attack + this.decay);
        //noteGain.gain.linearRampToValueAtTime(0, ctx.currentTime + this.attack + this.decay + this.release);

        osc.connect(noteGain);
        noteGain.connect(destination);

        osc.start();

        return noteGain;
    }
}

function midiToFrequency(note) {
    return 440 * Math.pow(2, (note - 69) / 12);
}