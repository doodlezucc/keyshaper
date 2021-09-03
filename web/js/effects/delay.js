class Delay extends AudioEffect {
    constructor() {
        const inputGain = ctx.createGain();
        const merger = ctx.createGain();
        super("delay", new NodeChain(inputGain, merger));

        this.node = ctx.createDelay(10);
        this.feedback = ctx.createGain();
        this.dryGain = ctx.createGain();
        this.wetGain = ctx.createGain();

        inputGain.connect(this.node);
        inputGain.connect(this.dryGain);
        this.node.connect(this.feedback);
        this.feedback.connect(this.node);
        this.feedback.connect(this.wetGain);

        this.dryGain.connect(merger);
        this.wetGain.connect(merger);

        this.node.delayTime.value = 0.2;
        this.feedback.gain.value = 0.5;
        this.dryGain.gain.value = 1;
        this.wetGain.gain.value = 1;

        const inputs = this.controls.elem.querySelectorAll("input");
        registerInput(inputs[0], (v) => { this.node.delayTime.value = v; });
        registerInput(inputs[1], (v) => { this.feedback.gain.value = v; });
        registerInput(inputs[2], (v) => { this.dryGain.gain.value = v; });
        registerInput(inputs[3], (v) => { this.wetGain.gain.value = v; });
        this.applyInputs();
    }

    applyInputs() {
        const inputs = this.controls.elem.querySelectorAll("input");
        inputs[0].value = this.node.delayTime.value;
        inputs[1].value = this.feedback.gain.value;
        inputs[2].value = this.dryGain.gain.value;
        inputs[3].value = this.wetGain.gain.value;
    }

    paramsToJson() {
        return {
            "time": this.node.delayTime.value,
            "feedback": this.feedback.gain.value,
            "dry": this.dryGain.gain.value,
            "wet": this.wetGain.gain.value,
        }
    }

    paramsFromJson(j) {
        this.node.delayTime.value = j["time"];
        this.feedback.gain.value = j["feedback"];
        this.dryGain.gain.value = j["dry"];
        this.wetGain.gain.value = j["wet"];
        this.applyInputs();
    }
}

registerEffect("delay", () => new Delay());