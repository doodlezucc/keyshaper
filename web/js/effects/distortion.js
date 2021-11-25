class Distortion extends AudioEffect {
    constructor() {
        const waveShaper = ctx.createWaveShaper();
        const outGain = ctx.createGain();
        super("distortion", "Distortion", new NodeChain(waveShaper, outGain));

        waveShaper.connect(outGain);
        this.waveShaper = waveShaper;
        this.outGain = outGain;

        outGain.gain.value = 0.8;
        this.updateCurve(50);

        const inputs = this.controls.content.querySelectorAll("input");
        registerInput(inputs[0], (v) => { this.updateCurve(v); });
        registerInput(inputs[1], (v) => { this.outGain.gain.value = v; });
        this.applyInputs();
    }

    applyInputs() {
        const inputs = this.controls.content.querySelectorAll("input");
        inputs[0].value = this.amount;
        inputs[1].value = this.outGain.gain.value;
    }

    updateCurve(amount) {
        this.amount = amount;
        this.waveShaper.curve = this.makeDistortionCurve(this.amount);
    }

    sigmoid(k, t) {
        return -1 + 2 / (1 + Math.exp(-t / k));
    }

    createSigmoidCurve(k) {
        const samples = 1024;
        const arr = new Float32Array(samples);

        const range = 5;
        for (let i = 0; i < samples; i++) {
            let t = i / (samples - 1);
            t = -range + t * 2 * range;
            arr[i] = this.sigmoid(k, t);
        }

        return arr;
    }

    makeDistortionCurve(amount) {
        var k = amount,
            n_samples = sampleRate,
            curve = new Float32Array(n_samples),
            deg = Math.PI / 180,
            x;
        for (let i = 0; i < n_samples; i++) {
            x = i * 2 / n_samples - 1;
            curve[i] = (3 + k) * Math.atan(Math.sinh(x * 0.25) * 5) / (Math.PI + k * Math.abs(x));
        }
        return curve;
    }

    paramsToJson() {
        return {
            "amount": this.amount,
            "outGain": this.outGain.gain.value,
        }
    }

    paramsFromJson(j) {
        this.outGain.gain.value = j["outGain"] ?? 1;
        this.updateCurve(j["amount"] ?? 1);
        this.applyInputs();
    }
}

registerEffect("distortion", () => new Distortion());