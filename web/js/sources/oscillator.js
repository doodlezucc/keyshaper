class Oscillator extends AudioSource {
    constructor() {
        super("oscillator");
        this.oscType = "sine";
        this.attack = 0;
        //this.hold = 0;
        this.decay = 0.04;
        this.sustain = 0.8;
        this.release = 0.2;

        const select = this.controls.elem.querySelector("select");
        select.oninput = () => {
            this.oscType = select.value;
        };
    }

    createNotePlayer(note, velocity, start) {
        const osc = ctx.createOscillator();
        osc.type = this.oscType;
        osc.frequency.value = midiToFrequency(note);

        const noteGain = ctx.createGain();
        noteGain.gain.setValueAtTime(0, start);
        noteGain.gain.linearRampToValueAtTime(velocity, start + this.attack);
        noteGain.gain.linearRampToValueAtTime(velocity * this.sustain, start + this.attack + this.decay);

        osc.connect(noteGain);
        osc.start(start);

        return new PlayingNote(noteGain, (amount) => {
            osc.detune.value = amount * 200;
        }, (when) => {
            noteGain.gain.cancelAndHoldAtTime(when);
            noteGain.gain.setValueAtTime(noteGain.gain.value, when);
            noteGain.gain.linearRampToValueAtTime(0, when + this.release);
            return new Promise((resolve) => {
                setTimeout(resolve, this.release * 1000);
            })
        });
    }

    paramsToJson() {
        return {
            "type": this.oscType,
            "attack": this.attack,
            "decay": this.decay,
            "sustain": this.sustain,
            "release": this.release,
        };
    }

    paramsFromJson(j) {
        this.oscType = j["type"];
        this.attack = j["attack"];
        this.decay = j["decay"];
        this.sustain = j["sustain"];
        this.release = j["release"];
    }
}