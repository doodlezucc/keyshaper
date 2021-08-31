class Reverb extends AudioEffect {
    constructor() {
        const inputGain = ctx.createGain();
        const merger = ctx.createGain();
        super(new NodeChain(inputGain, merger));

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
    }

    updateBuffer(dur) {
        this.duration = dur;
        const samples = dur * sampleRate;
        const buffer = ctx.createBuffer(1, samples, sampleRate);
        const arr = new Float32Array(samples);
        for (let i = 0; i < samples; i++) {
            const x = 1 - i / samples;
            arr[i] = (Math.random() * 2 - 1) * Math.pow(x, 5);
        }

        buffer.copyToChannel(arr, 0);
        this.node.buffer = buffer;
    }
}