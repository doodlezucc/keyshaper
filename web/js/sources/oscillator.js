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
        const inputs = this.controls.elem.querySelectorAll("input");
        registerInput(inputs[0], (v) => { this.attack = v; });
        registerInput(inputs[1], (v) => { this.decay = v; });
        registerInput(inputs[2], (v) => { this.sustain = v; });
        registerInput(inputs[3], (v) => { this.release = v; });
        this.applyInputs();
    }

    applyInputs() {
        const select = this.controls.elem.querySelector("select");
        select.value = this.oscType;
        const inputs = this.controls.elem.querySelectorAll("input");
        inputs[0].value = this.attack;
        inputs[1].value = this.decay;
        inputs[2].value = this.sustain;
        inputs[3].value = this.release;
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
            if (when < start) {
                return Promise.resolve();
            }

            const oscTime = when - start;
            let val = this.sustain;

            if (oscTime < this.attack) {
                val = oscTime / this.attack;
            } else if (oscTime < this.attack + this.decay) {
                val = 1 - (oscTime / (this.attack + this.decay)) * (1 - this.sustain);
            }

            noteGain.gain.cancelScheduledValues(when - 0.001);
            noteGain.gain.setValueAtTime(val * velocity, when);
            noteGain.gain.linearRampToValueAtTime(0, when + this.release);
            osc.stop(when + this.release);

            return new Promise((resolve) => {
                setTimeout(resolve, 1000 * (when - ctx.currentTime + this.release));
            });
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