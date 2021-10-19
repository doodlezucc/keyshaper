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
     * @returns {Promise<Clip>}
     */
    async startRecording(deviceIndex) {
        if (!this.isRecording) {
            this.isRecording = true;

            if (project.isPaused) {
                project.play();
            }

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
                    resolve(new Clip(ev.data));
                }
            });
        }
    }

    stopRecording() {
        this.isRecording = false;
        this.mediaRecorder.stop();
        if (!project.isPaused) {
            project.pause();
        }
    }
}

class Clip extends TimelineItem {
    constructor(blob) {
        super("recording", 1);

        /** @type {Blob} */
        this.blob = blob;

        this.isPlaying = false;

        this.start = 0;
        this.sampleOffset = 0;

        this.updateAudioContext();

        this.peaks = document.createElementNS("http://www.w3.org/2000/svg", "path");
        this.elem.append(this.peaks);

        this._init();
    }

    _init() {
        const time = Date.now();
        const reader = new FileReader();
        reader.onloadend = async () => {
            this.audioBuffer = await ctx.decodeAudioData(reader.result);
            if (project.unitLength == 1000) {
                this.length = 1;
                project.calculateFirstUnitLength();
            } else {
                this.length = this.audioBuffer.duration / project.unitLength;
                this.redrawElem();
            }
            console.log("Read recording in " + (Date.now() - time) + "ms.");
        }
        reader.readAsArrayBuffer(this.blob);
    }

    redrawElem() {
        super.redrawElem();

        const arr = this.audioBuffer.getChannelData(0);
        let svgData = "M 0 " + (0.5 * patternHeight);

        const steps = 10000;
        for (let i = 0; i < steps; i++) {
            const x = patternWidth * this.length * i / steps;
            const y = (0.5 + 0.5 * arr[Math.floor(arr.length * i / steps)]) * patternHeight;
            svgData += " L " + x + " " + y;
        }

        this.peaks.setAttribute("d", svgData);
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
        const loopLength = project.longestItem * project.unitLength;
        const loopStart = project.ctxStart + Math.floor(start / loopLength) * loopLength;
        const wStart = start % loopLength;
        const wEnd = end % loopLength;
        const wrap = wStart > wEnd;

        const nStart = this.start * this.scaling * project.unitLength;
        const nEnd = this.end * this.scaling * project.unitLength;
        const ctxNStart = loopStart + nStart;
        const ctxNEnd = loopStart + nEnd;

        if (wrap) {
            if (nEnd >= wStart) {
                this._noteEvent(false, ctxNEnd);
            }
            else if (nEnd < wEnd) {
                this._noteEvent(false, ctxNEnd + loopLength);
            }
            if (nStart >= wStart) {
                this._noteEvent(true, ctxNStart);
            }
            else if (nStart < wEnd) {
                this._noteEvent(true, ctxNStart + loopLength);
            }
        } else {
            if (nEnd >= wStart && nEnd < wEnd) {
                this._noteEvent(false, ctxNEnd);
            }
            if (nStart >= wStart && nStart < wEnd) {
                this._noteEvent(true, ctxNStart);
            }
        }
    }

    _noteEvent(on, when) {
        if (on) {
            this.node = new AudioBufferSourceNode(ctx, {
                buffer: this.audioBuffer
            });
            this.node.connect(this.gain);
            this.node.start(when, this.sampleOffset);
        } else {
            if (this.node) {
                this.cancel(when);
            }
        }
    }

    cancel(time) {
        if (this.node) {
            const reference = this.node;
            setTimeout(() => {
                reference.disconnect();
            }, 1000 * (time - ctx.currentTime));
            reference.stop(time);
        }
        this.isPlaying = false;
    }

    updateAudioContext() {
        if (this.gain) {
            this.gain.disconnect();
        }
        this.gain = new GainNode(ctx, {
            gain: 0.8
        });
        this.gain.connect(project.effectRack.chainStart);
    }
}