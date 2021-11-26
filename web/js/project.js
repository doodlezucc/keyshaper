const frameLength = 60;

const patternWidth = 200;
const patternHeight = 40;

const timelineCursor = document.getElementById("timelineCursor");

class Project {
    constructor() {
        this.unitLength = 1000;

        /** @type {AudioSource[]} */
        this.audioSources = [];
        this.mixer = new Mixer();
        this.mixer.master.chainEnd.connect(ctx.destination);

        /** @type {Loop[]} */
        this.loops = [
            new Loop(),
            new Loop(),
            new Loop(),
            new Loop(),
        ];
        this.activeLoopIndex = 0;
        this.ctxStart = 0;
        this.lastFrame = -1;
        this.isRendering = false;
        this.isRecording = true;

        this.recorder = new Recorder();

        this.isPaused = true;
        setInterval(() => {
            if (!this.isPaused) {
                this.bake();
            }
        }, frameLength - 5);

        this.longestItem = 1;
        this.redrawTimelineGuides();
        this.zeroItemsEvent();

        // 60 FPS redraws
        setInterval(() => {
            if (!this.isPaused) {
                const diff = ctx.currentTime - this.ctxStart;
                const x = patternWidth * ((diff / this.unitLength) % this.longestItem);
                timelineCursor.setAttribute("x1", x);
                timelineCursor.setAttribute("x2", x);
            }
        }, 1000 / 60);
    }

    get activeLoop() {
        return this.loops[this.activeLoopIndex];
    }

    zeroItemsEvent() {
        this.unitLength = 1000;
        this.longestItem = 1;
        this.redrawTimelineGuides();
    }

    redrawTimelineGuides() {
        const w = patternWidth / 4;
        const subdivisions = 4;
        const pattern = document.getElementById("pattern");
        pattern.setAttribute("width", w);
        for (let i = 1; i < subdivisions; i++) {
            const x = w * i / subdivisions;
            pattern.children.item(i).setAttribute("x1", x);
            pattern.children.item(i).setAttribute("x2", x);
        }
    }

    play() {
        this.ctxStart = ctx.currentTime;
        this.lastFrame = -1;
        this.isPaused = false;
        ctx.resume();
        this.bake();
        console.log("Play");
    }

    pause() {
        this.isPaused = true;
        console.log("Pause");

        this.loops.forEach(l => l.onPause());
        timelineCursor.setAttribute("x1", 0);
        timelineCursor.setAttribute("x2", 0);
    }

    /** @type {TimelineItem[]} */
    get timelineItems() {
        return this.loops.reduce((arr, loop) => {
            return arr.concat(loop.clips, loop.patterns);
        }, []);
    }

    bake() {
        const time = ctx.currentTime - this.ctxStart;
        const currentStep = (time * 1000) / frameLength;
        while (currentStep >= this.lastFrame) {
            this.lastFrame++;
            // console.log("Baking audio frame " + this.lastFrame);

            const start = this.lastFrame * frameLength / 1000;
            const end = start + frameLength / 1000;

            for (const loop of this.loops) {
                loop.bake(start, end);
            }
        }
    }

    test() {
        this.unitLength = 3;
        this.audioSources.push(new DrumPad(), new Oscillator());

        const drumPattern = new Pattern(0);
        drumPattern.notes = [
            new Note(36, 1, 0, 1),
            new Note(38, 1, 4, 1),
            new Note(38, 0.6, 7, 1),
            new Note(38, 0.8, 9, 1),
            new Note(36, 1, 10, 1),
            new Note(38, 1, 12, 1),
            new Note(36, 1, 13, 1),
        ];
        drumPattern.scaling = 0.1875;
        drumPattern.redrawElem();
        this.activeLoop.patterns.push(drumPattern);

        const oscPattern = new Pattern(1, 2);
        oscPattern.redrawElem();
        this.activeLoop.patterns.push(oscPattern);
        this.selectItem(1);

        this.mixer.master.insert(new Reverb(), 0);
    }

    async render() {
        this.pause();
        this.isRendering = true;
        console.log("Rendering...");

        const length = this.unitLength * this.longestItem;
        const originalCtx = ctx;
        ctx = new OfflineAudioContext({
            length: length * sampleRate,
            sampleRate: sampleRate,
            numberOfChannels: 2,
        });

        const originalCtxStart = this.ctxStart;
        this.ctxStart = 0;

        const originalMixer = this.mixer;
        this.mixer = new Mixer();
        this.mixer.master.chainEnd.connect(ctx.destination);

        // Change this if you ever decide to make the number of tracks dynamic
        for (let i = 0; i < originalMixer.allTracks.length; i++) {
            for (const fx of originalMixer.allTracks[i].effects) {
                /** @type {AudioEffect} */
                const newFX = effectLookup[fx.type]();
                newFX.paramsFromJson(fx.paramsToJson());
                this.mixer.allTracks[i].append(newFX);
            }
        }

        const originalSources = this.audioSources;
        this.audioSources = [];
        for (const src of originalSources) {
            /** @type {AudioSource} */
            const newSource = AudioSource.fromJson(src.toJson());
            this.audioSources.push(newSource);
        }

        let serialize = this.audioSources;
        this.mixer.allTracks.forEach(t => serialize = serialize.concat(t.effects));

        await Promise.all(serialize.map(src => src.preloadAllResources()));

        this.loops.forEach(l => l.clips.forEach(c => c.updateAudioContext()));

        const step = frameLength / 1000;
        for (let t = 0; t < length; t += step) {
            const end = t + step;
            for (const loop of this.loops) {
                loop.bake(t, end);
            }
        }

        /** @type {AudioBuffer} */
        const buffer = await ctx.startRendering();

        const channelData = [];
        for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
            channelData[ch] = buffer.getChannelData(ch);
        }

        const sendable = {
            channels: channelData,
            length: buffer.length,
            sampleRate: buffer.sampleRate,
        }

        const converter = new Worker("js/converter.js");
        const promise = new Promise(resolve => {
            converter.onmessage = resolve;
        })

        converter.postMessage(["wav", sendable]);

        /** @type {Blob} */
        const result = (await promise).data;

        const audioElem = document.createElement("audio");
        audioElem.controls = true;
        audioElem.src = URL.createObjectURL(result);
        document.body.append(audioElem);

        ctx = originalCtx;
        this.ctxStart = originalCtxStart;
        this.mixer = originalMixer;
        this.audioSources = originalSources;
        this.loops.forEach(l => l.clips.forEach(c => c.updateAudioContext()));
        this.isRendering = false;
        console.log("Done!");
    }

    calculateFirstUnitLength() {
        if (this.activeLoop.clips.length) {
            project.unitLength = this.activeLoop.clips[0].audioBuffer.duration;
        } else {
            project.unitLength = ctx.currentTime - project.ctxStart;
        }

        let bpm = 4 * 60 / project.unitLength;
        while (bpm < 70) {
            project.unitLength /= 2;
            bpm *= 2;
            project.timelineItems[0].length *= 2;
        }
        project.redrawTimelineGuides();
        project.timelineItems[0].redrawElem();

        console.log("Set unit length to " + project.unitLength.toFixed(3) + " seconds, " + bpm.toFixed(1) + " BPM");
    }

    dispose() {
        for (const source of this.audioSources) {
            source.dispose();
        }
        for (const track of this.mixer.allTracks) {
            for (const effect of track.effects) {
                effect.dispose();
            }
        }
        this.mixer.master.chainEnd.disconnect(0);
        for (const item of this.timelineItems) {
            item.dispose();
        }
        this.isPaused = true;
    }

    save(name) {
        const obj = {
            "unitLength": this.unitLength,
            "audioSources": this.audioSources.map(e => e.toJson()),
            "mixer": this.mixer.toJson(),
            "loops": this.loops.map(e => e.toJson()),
        };
        console.log(obj);
        if (!name) {
            name = window.prompt("Enter a project name");
        }
        window.localStorage.setItem(name, JSON.stringify(obj));
    }

    static async load(name) {
        project.dispose();

        const j = JSON.parse(window.localStorage.getItem(name));
        console.log(j);
        project = new Project();
        project.unitLength = j["unitLength"];

        for (const e of j["audioSources"]) {
            project.audioSources.push(AudioSource.fromJson(e));
        }

        // backwards compatibility, replaced by mixer
        const jEffects = j["effectRack"] ?? [];
        for (const fx of jEffects) {
            project.mixer.master.append(AudioEffect.fromJson(fx));
        }

        const jMixer = j["mixer"];
        if (jMixer) {
            project.mixer.fromJson(jMixer);
        }

        project.loops = [];
        for (const jLoop of j["loops"]) {
            const loop = new Loop();
            project.loops.push(loop);
            await loop.fromJson(jLoop);
        }
        return project;
    }
}

class TimelineItem {
    constructor(className, length = 1) {
        this.elem = document.createElementNS("http://www.w3.org/2000/svg", "g");
        this.elem.classList.add(className);
        this.elem.onclick = () => {
            project.activeLoop.selectItem(project.activeLoop.timelineItems.indexOf(this));
        };

        const off = patternHeight * project.timelineItems.length;
        this.elem.setAttribute("transform", "translate(0, " + off + ")");

        this.background = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        this.background.setAttribute("height", patternHeight);
        this.background.classList.add("pattern-background");
        this.elem.append(this.background);

        this.length = length;
        this.scaling = 1;

        document.getElementById("timeline").prepend(this.elem);
    }

    redrawElem() {
        if (this.length > project.longestItem) {
            project.longestItem = this.length;
        }
        this.background.setAttribute("width", patternWidth * this.length);
    }

    dispose() {
        this.elem.remove();
    }

    bake(start, end, loop) {
        console.warn('Unhandled baking');
    }
}

class Pattern extends TimelineItem {
    constructor(audioSourceIndex, length = 1) {
        super("pattern", length);

        /** @type {Note[]} */
        this.notes = [];
        /** @type {Note[]} */
        this.registering = [];
        this.audioSourceIndex = audioSourceIndex;

        this.redrawElem();
    }

    /** @type {AudioSource} */
    get audioSource() {
        return project.audioSources[this.audioSourceIndex];
    }

    _sortNotes() {
        // Sort notes so that the last note is in first place
        this.notes.sort((a, b) => b.start - a.start);
    }

    registerNote(pitch, velocity, when) {
        const time = ((when - project.ctxStart) % (this.length * project.unitLength)) / this.scaling;
        const note = new Note(pitch, velocity, time, 1000);
        this.notes.push(note);
        this._sortNotes();
        this.registering.push(note);
        this.redrawElem();
    }

    finishRegisteringNote(pitch, when) {
        let time = ((when - project.ctxStart) % (this.length * project.unitLength)) / this.scaling;

        this.registering = this.registering.filter(note => {
            if (note.pitch == pitch) {
                if (note.start > time) {
                    time += this.length * project.unitLength / this.scaling;
                }
                note.length = time - note.start;
                return false;
            }
            return true;
        });

        this.redrawElem();
    }

    redrawElem() {
        super.redrawElem();

        while (this.elem.childElementCount > 1) {
            this.elem.removeChild(this.elem.lastChild);
        }

        if (this.notes.length) {
            const length = this.length * project.unitLength;

            let min = Infinity;
            let max = 0;
            for (const note of this.notes) {
                if (note.pitch < min) min = note.pitch;
                if (note.pitch > max) max = note.pitch;
            }

            const w = patternWidth * this.length;
            const h = patternHeight;
            const yDelta = Math.max(12, max - min);

            for (const note of this.notes) {
                const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                rect.setAttribute("x", w * this.scaling * note.start / length);
                rect.setAttribute("y", h * (1 - (note.pitch - min + 1) / (yDelta + 1)));
                rect.setAttribute("width", w * this.scaling * note.length / length);
                rect.setAttribute("height", h / yDelta);
                this.elem.append(rect);
                rect.classList.add("pattern-note");
            }
        }
    }

    /**
     * @param {number} start
     * @param {number} end
     * @param {Loop} loop
     */
    bake(start, end, loop) {
        const loopLength = loop.length * project.unitLength;
        const loopStart = project.ctxStart + Math.floor(start / loopLength) * loopLength;
        const wStart = start % loopLength;
        const wEnd = end % loopLength;
        const wrap = wStart > wEnd;

        for (const note of this.notes) {
            const nStart = note.start * this.scaling;
            const nEnd = note.end * this.scaling;
            const ctxNStart = loopStart + nStart;
            const ctxNEnd = loopStart + nEnd;

            if (nStart < loopLength) {
                if (wrap) {
                    if (nStart >= wStart) {
                        this._noteEvent(note, true, ctxNStart);
                    }
                    else if (nStart < wEnd) {
                        this._noteEvent(note, true, ctxNStart + loopLength);
                    }
                    if (nEnd >= wStart) {
                        if (!this.registering.some(n => n == note)) {
                            this._noteEvent(note, false, loopStart + loopLength);
                        }
                    }
                    else if (nEnd < wEnd) {
                        this._noteEvent(note, false, ctxNEnd + loopLength);
                    }
                } else {
                    if (nStart >= wStart && nStart < wEnd) {
                        this._noteEvent(note, true, ctxNStart);
                    }
                    if (nEnd >= wStart && nEnd < wEnd) {
                        this._noteEvent(note, false, ctxNEnd);
                    }
                }
            }
        }
    }

    _noteEvent(note, on, when) {
        if (on) {
            this.audioSource._noteOn(note.pitch, note.velocity, when);
        } else {
            this.audioSource._noteOff(note.pitch, when);
        }
    }

    toJson() {
        return {
            "source": this.audioSourceIndex,
            "length": this.length,
            "scaling": this.scaling,
            "notes": this.notes.map((note) => note.toJson()),
        };
    }

    static fromJson(j) {
        const pattern = new Pattern(j["source"], j["length"]);
        pattern.scaling = j["scaling"];
        for (const note of j["notes"]) {
            pattern.notes.push(Note.fromJson(note));
        }
        pattern._sortNotes();
        pattern.redrawElem();
        return pattern;
    }
}

class Note {
    constructor(pitch, velocity, start, length) {
        this.pitch = pitch;
        this.velocity = velocity;
        this.start = start;
        this.length = length;
    }

    get end() {
        return this.start + this.length;
    }

    static fromJson(j) {
        return new Note(j["pitch"], j["velocity"], j["start"], j["length"]);
    }

    toJson() {
        return {
            "pitch": this.pitch,
            "velocity": this.velocity,
            "start": this.start,
            "length": this.length,
        };
    }
}