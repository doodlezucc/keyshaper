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

            const device = this.inputs[deviceIndex];
            const stream = await window.navigator.mediaDevices.getUserMedia({
                audio: {
                    deviceId: device.deviceId,
                    echoCancellation: false,
                }
            });

            const playbackNode = new MediaStreamAudioSourceNode(ctx, {
                mediaStream: stream
            });
            playbackNode.connect(project.mixer.tracks[0].chainStart);

            return new Promise(resolve => {
                this.mediaRecorder = new MediaRecorder(stream);
                this.mediaRecorder.start();
                this.mediaRecorder.ondataavailable = (ev) => {
                    playbackNode.disconnect();
                    const latency = Calibration.latencies[devicePersistentId(device)];
                    const name = "recording-" + dateToFileString(new Date());
                    const resource = new Resource(name, name, ev.data);
                    resource.save();
                    const clip = new Clip(resource, latency);
                    clip._init();
                    resolve(clip);
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

/**
 * @param {MediaDeviceInfo} device
 */
function devicePersistentId(device) {
    const descriptors = device.label.match(/(?<=\().+?(?=\))/g);
    return descriptors[descriptors.length - 1];
}

class Calibration {
    static latencies = JSON.parse(window.localStorage.getItem("latencies") ?? "{}");

    static saveLatencies() {
        window.localStorage.setItem("latencies", JSON.stringify(this.latencies));
    }

    /**
     * @param {MediaDeviceInfo} device
     * @param {number} beats
     * @param {number} bps
     * @returns {Promise<number>}
     */
    static async runCalibration(device, beats, bps = 2) {
        const metronomeBuffer = await loadAudioFromUrl("resources/drums/eternityperc13.wav");

        const stream = await window.navigator.mediaDevices.getUserMedia({
            audio: {
                deviceId: device.deviceId,
                echoCancellation: false,
            }
        });

        beats += 8;

        const mediaRecorder = new MediaRecorder(stream);
        const offset = 0.2;
        const firstBeatCtx = ctx.currentTime + offset;

        mediaRecorder.start();

        for (let i = 0; i < beats; i++) {
            const metronomeNode = new AudioBufferSourceNode(ctx, { buffer: metronomeBuffer });
            metronomeNode.connect(ctx.destination);
            metronomeNode.start(firstBeatCtx + i / bps);
        }

        await new Promise(resolve => setTimeout(resolve, 1000 * (offset + beats / bps)));

        const blob = await new Promise(resolve => {
            mediaRecorder.ondataavailable = (ev) => {
                resolve(ev.data);
            }
            mediaRecorder.stop();
        });
        const recorded = await blobToAudioBuffer(blob);
        const evaluated = await Calibration.evaluate(recorded, bps, 8, offset);
        console.log(evaluated);
        this.latencies[devicePersistentId(device)] = evaluated;

        return evaluated;
    }

    /**
     * By order of the peaky finders.
     * @param {AudioBuffer} audioBuffer
     * @param {number} bps
     */
    static async evaluate(audioBuffer, bps, ignore = 0, offset = 0) {
        // only use first channel
        const data = audioBuffer.getChannelData(0);
        const sampleRate = audioBuffer.sampleRate;
        const lookBehind = 200;

        const start = sampleRate * ignore / bps;
        const peakSeconds = [];

        for (let i = start + lookBehind; i < audioBuffer.length; i++) {
            let avg = 0;
            for (let j = 1; j <= lookBehind; j++) {
                avg += Math.abs(data[i - j]);
            }
            avg /= lookBehind;

            if (Math.abs(data[i]) > avg * 2 + 0.02) {
                peakSeconds.push(i / sampleRate - offset);
                i += 0.5 * sampleRate / bps;
            }
        }

        let latency = 0;
        const beatDur = 1 / bps;
        for (const peak of peakSeconds) {
            let pLate = peak % beatDur;
            if (pLate > beatDur * 0.8) {
                // treat peak as being too early
                pLate = -beatDur + pLate;
            }

            latency += pLate;
        }

        return latency / peakSeconds.length;
    }
}

class Clip extends TimelineItem {
    constructor(resource, sampleOffset = 0) {
        super("recording", 1);

        /** @type {Resource} */
        this.resource = resource;

        this.isPlaying = false;

        this.start = 0;
        this.sampleOffset = sampleOffset ?? 0;

        this.updateAudioContext();

        this.peaks = document.createElementNS("http://www.w3.org/2000/svg", "path");
        this.elem.append(this.peaks);
    }

    toJson() {
        return {
            "resource": this.resource.id,
            "start": this.start,
            "length": this.length,
            "scaling": this.scaling,
            "sampleOffset": this.sampleOffset,
        };
    }

    static async fromJson(j) {
        const clip = new Clip(Resource.lookup(j["resource"]), j["sampleOffset"]);
        clip.start = j["start"];
        clip.length = j["length"];
        clip.scaling = j["scaling"];
        await clip._init();
        return clip;
    }

    async _init() {
        const time = Date.now();
        this.audioBuffer = await loadAudioFromResource(this.resource);
        if (project.unitLength == 1000) {
            this.length = 1;
            project.calculateFirstUnitLength();
        } else {
            this.length = this.audioBuffer.duration / project.unitLength;
            this.redrawElem();
        }
        console.log("Read recording in " + (Date.now() - time) + "ms.");
    }

    redrawElem() {
        super.redrawElem();

        const arr = this.audioBuffer.getChannelData(0);
        const cutStart = this.sampleOffset * this.audioBuffer.sampleRate;
        let svgData = "M 0 " + (0.5 * patternHeight);

        const steps = 10000;
        for (let i = 0; i < steps; i++) {
            const x = patternWidth * this.length * i / steps;
            const data = arr[Math.floor(cutStart + (arr.length - cutStart) * i / steps)];
            const y = (0.5 + 0.5 * data) * patternHeight;
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
        this.gain.connect(project.mixer.tracks[0].chainStart);
    }
}