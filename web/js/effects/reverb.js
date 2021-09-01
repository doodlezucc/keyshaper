class Reverb extends AudioEffect {
    constructor() {
        const inputGain = ctx.createGain();
        const merger = ctx.createGain();
        super("reverb", new NodeChain(inputGain, merger));

        this.node = ctx.createConvolver();
        this.dryGain = ctx.createGain();
        this.wetGain = ctx.createGain();

        inputGain.connect(this.node);
        inputGain.connect(this.dryGain);
        this.node.connect(this.wetGain);

        this.dryGain.connect(merger);
        this.wetGain.connect(merger);

        this.duration = 2;
        this.updateBuffer(this.duration);

        this.dryGain.gain.value = 1;
        this.wetGain.gain.value = 0.3;

        const inputs = this.controls.elem.querySelectorAll("input");
        registerInput(inputs[0], (v) => { this.updateBuffer(v); });
        registerInput(inputs[1], (v) => { this.dryGain.gain.value = v; });
        registerInput(inputs[2], (v) => { this.wetGain.gain.value = v; });
        this.applyInputs();
    }

    applyInputs() {
        const inputs = this.controls.elem.querySelectorAll("input");
        inputs[0].value = this.duration;
        inputs[1].value = this.dryGain.gain.value;
        inputs[2].value = this.wetGain.gain.value;
    }

    updateBuffer(dur) {
        this.duration = dur;
        const samples = dur * sampleRate;
        const buffer = ctx.createBuffer(1, samples, sampleRate);
        const arr = buffer.getChannelData(0);
        for (let i = 0; i < samples; i++) {
            const x = 1 - i / samples;
            arr[i] = (Math.random() * 2 - 1) * x * x * x * x * x;
        }
        this.node.buffer = buffer;
    }
}