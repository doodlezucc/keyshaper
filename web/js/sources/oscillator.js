class Oscillator extends AudioSource {
    constructor() {
        super("oscillator");
        this.type = "sine";
        this.attack = 0;
        //this.hold = 0;
        this.decay = 0.04;
        this.sustain = 0.8;
        this.release = 0.2;

        const select = this.controls.elem.querySelector("select");
        select.oninput = () => {
            this.type = select.value;
        };
    }

    createNotePlayer(note, velocity) {
        const start = ctx.currentTime;

        const osc = ctx.createOscillator();
        osc.type = this.type;
        osc.frequency.value = midiToFrequency(note);

        const noteGain = ctx.createGain();
        noteGain.gain.setValueAtTime(0, start);
        noteGain.gain.linearRampToValueAtTime(velocity, start + this.attack);
        noteGain.gain.linearRampToValueAtTime(velocity * this.sustain, start + this.attack + this.decay);

        osc.connect(noteGain);
        osc.start();

        return new PlayingNote(noteGain, (amount) => {
            osc.detune.value = amount * 200;
        }, () => {
            noteGain.gain.cancelAndHoldAtTime(ctx.currentTime);
            noteGain.gain.setValueAtTime(noteGain.gain.value, ctx.currentTime);
            noteGain.gain.linearRampToValueAtTime(0, ctx.currentTime + this.release);
        });
    }
}