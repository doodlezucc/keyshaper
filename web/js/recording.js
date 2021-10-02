class Recorder {
    constructor() {
        /** @type {MediaDeviceInfo[]} */
        this.inputs = [];
        this.isRecording = false;

        this._init();
    }

    async _init() {
        const devices = await window.navigator.mediaDevices.enumerateDevices();

        for (const device of devices) {
            if (device.kind === 'audioinput') {
                if (!this.inputs.some(d => d.groupId === device.groupId)) {
                    console.log(device.label);
                    this.inputs.push(device);
                }
            }
        }
    }

    /**
     * @param {number} deviceIndex 
     * @returns {Promise<Recording>}
     */
    async startRecording(deviceIndex) {
        if (!this.isRecording) {
            this.isRecording = true;

            const stream = await window.navigator.mediaDevices.getUserMedia({
                audio: {
                    deviceId: this.inputs[deviceIndex].deviceId,
                    echoCancellation: false,
                }
            });

            const playbackNode = new MediaStreamAudioSourceNode(ctx, {
                mediaStream: stream
            });
            playbackNode.connect(project.effectRack.chainStart);

            return new Promise(resolve => {
                this.mediaRecorder = new MediaRecorder(stream);
                this.mediaRecorder.start();
                this.mediaRecorder.ondataavailable = (ev) => {
                    playbackNode.disconnect();
                    resolve(new Recording(ev.data));
                }
            });
        }
    }

    stopRecording() {
        this.isRecording = false;
        this.mediaRecorder.stop();
    }
}

class Recording extends TimelineItem {
    constructor(blob) {
        super(1);

        /** @type {Blob} */
        this.blob = blob;

        this.isPlaying = false;

        this.start = 0;
        this.sampleOffset = 0;
        this.sampleLength = 1;

        this.gain = new GainNode(ctx, {
            gain: 0.7
        });
        this.gain.connect(project.effectRack.chainStart);

        this._init();
    }

    _init() {
        const time = Date.now();
        const reader = new FileReader();
        reader.onloadend = async () => {
            this.audioBuffer = await ctx.decodeAudioData(reader.result);
            this.length = this.audioBuffer.duration / project.unitLength;
            this.redrawElem();
            console.log("Read recording in " + (Date.now() - time) + "ms.");
        }
        reader.readAsArrayBuffer(this.blob);
    }

    get end() {
        return this.start + this.length;
    }

    /**
     * @param {number} start 
     * @param {number} end 
     * @param {Project} project 
     */
    bake(start, end, project) {
        const loopTime = project.longestPattern * project.unitLength;
        const loopStart = project.ctxStart + Math.floor(start / loopTime) * loopTime;
        const wStart = start % loopTime;
        const wEnd = end % loopTime;
        const wrap = wStart > wEnd;

        const nStart = this.start * this.scaling * project.unitLength;
        const nEnd = this.end * this.scaling * project.unitLength;
        const ctxNStart = loopStart + nStart;
        const ctxNEnd = loopStart + nEnd;

        if (wrap) {
            if (nStart >= wStart) {
                this._noteEvent(true, ctxNStart);
            }
            else if (nStart < wEnd) {
                this._noteEvent(true, ctxNStart + loopTime);
            }
            if (nEnd >= wStart) {
                this._noteEvent(false, ctxNEnd);
            }
            else if (nEnd < wEnd) {
                this._noteEvent(false, ctxNEnd + loopTime);
            }
        } else {
            if (nStart >= wStart && nStart < wEnd) {
                this._noteEvent(true, ctxNStart);
            }
            if (nEnd >= wStart && nEnd < wEnd) {
                this._noteEvent(false, ctxNEnd);
            }
        }
    }

    _noteEvent(on, when) {
        if (on) {
            console.log("play");
            this.node = new AudioBufferSourceNode(ctx, {
                buffer: this.audioBuffer
            });
            this.node.connect(this.gain);
            this.node.start(when, this.sampleOffset);
        } else {
            console.log("stop " + when);
            if (this.node) {
                this.cancel(when);
            }
        }
    }

    cancel(time) {
        setTimeout(() => {
            this.node.disconnect();
        }, 1000 * (1 + time - ctx.currentTime));
        this.node.stop(time);
        this.isPlaying = false;
    }
}