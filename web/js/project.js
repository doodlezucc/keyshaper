const frameLength = 60;

const patternWidth = 300;
const patternHeight = 100;

const timelineCursor = document.getElementById("timelineCursor");

class Project {
    constructor() {
        this.unitLength = 1000;

        /** @type {AudioSource[]} */
        this.audioSources = [];
        this.effectRack = new EffectRack();
        this.effectRack.chainEnd.connect(ctx.destination);

        /** @type {Clip[]} */
        this.clips = [];

        /** @type {Pattern[]} */
        this.patterns = [];
        this.currentPattern = 0;
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

        this.longestPattern = 1;
        this.redrawTimelineGuides();
        this.zeroPatternsEvent();

        // 60 FPS redraws
        setInterval(() => {
            if (!this.isPaused) {
                const diff = ctx.currentTime - this.ctxStart;
                const x = patternWidth * ((diff / this.unitLength) % this.longestPattern);
                timelineCursor.setAttribute("x1", x);
                timelineCursor.setAttribute("x2", x);
            }
        }, 1000 / 60);
    }

    selectPattern(index) {
        project.currentPattern = index;
        src = project.patterns[project.currentPattern].audioSource;
        console.log("Selected pattern " + project.currentPattern);
    }

    removeCurrentPattern() {
        if (this.patterns.length) {
            this.patterns[this.currentPattern].dispose();
            this.patterns = this.patterns.filter((pattern, index) => {
                return index != this.currentPattern;
            });

            if (this.patterns.length) {
                this.selectPattern(this.currentPattern - 1);
            } else {
                this.zeroPatternsEvent();
            }
        }
    }

    zeroPatternsEvent() {
        this.unitLength = 1000;
        this.longestPattern = 1;
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

        for (const pattern of this.patterns) {
            pattern.audioSource.onBlur(ctx.currentTime);
        }
        for (const c of this.clips) {
            c.cancel(ctx.currentTime);
        }
        timelineCursor.setAttribute("x1", 0);
        timelineCursor.setAttribute("x2", 0);
    }

    get timelineItems() {
        return this.patterns.concat(this.clips);
    }

    bake() {
        const time = ctx.currentTime - this.ctxStart;
        const currentStep = (time * 1000) / frameLength;
        while (currentStep >= this.lastFrame) {
            this.lastFrame++;
            // console.log("Baking audio frame " + this.lastFrame);

            const start = this.lastFrame * frameLength / 1000;
            const end = start + frameLength / 1000;

            for (const item of this.timelineItems) {
                item.bake(start, end, this);
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
        this.patterns.push(drumPattern);

        const oscPattern = new Pattern(1, 2);
        oscPattern.redrawElem();
        this.patterns.push(oscPattern);
        this.selectPattern(1);

        this.effectRack.insert(new Reverb(), 0);
    }

    async render() {
        this.pause();
        this.isRendering = true;
        console.log("Rendering...");

        const length = this.unitLength * this.longestPattern;
        const originalCtx = ctx;
        ctx = new OfflineAudioContext({
            length: length * sampleRate,
            sampleRate: sampleRate,
            numberOfChannels: 2,
        });

        const originalCtxStart = this.ctxStart;
        this.ctxStart = 0;

        const originalEffectRack = this.effectRack;
        this.effectRack = new EffectRack();
        this.effectRack.chainEnd.connect(ctx.destination);

        for (const fx of originalEffectRack.effects) {
            /** @type {AudioEffect} */
            const newFX = effectLookup[fx.type]();
            newFX.paramsFromJson(fx.paramsToJson());
            this.effectRack.append(newFX);
        }

        const originalSources = this.audioSources;
        this.audioSources = [];
        for (const src of originalSources) {
            /** @type {AudioSource} */
            const newSource = sourceLookup[src.type]();
            newSource.paramsFromJson(src.paramsToJson());
            this.audioSources.push(newSource);
        }

        const step = frameLength / 1000;
        for (let t = 0; t < length; t += step) {
            const end = t + step;
            for (const pattern of this.patterns) {
                pattern.bake(t, end, this);
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
        this.effectRack = originalEffectRack;
        this.audioSources = originalSources;
        this.isRendering = false;
        console.log("Done!");
    }

    dispose() {
        for (const source of this.audioSources) {
            source.dispose();
        }
        for (const effect of this.effectRack.effects) {
            effect.dispose();
        }
        this.effectRack.chainEnd.disconnect(0);
        for (const pattern of this.patterns) {
            pattern.dispose();
        }
        this.isPaused = true;
    }

    save(name) {
        const obj = {
            "unitLength": this.unitLength,
            "audioSources": this.audioSources.map(e => e.toJson()),
            "effectRack": this.effectRack.effects.map(e => e.toJson()),
            "patterns": this.patterns.map(e => e.toJson()),
        };
        console.log(obj);
        if (!name) {
            name = window.prompt("Enter a project name");
        }
        window.localStorage.setItem(name, JSON.stringify(obj));
    }

    static load(name) {
        project.dispose();

        const j = JSON.parse(window.localStorage.getItem(name));
        console.log(j);
        project = new Project();
        project.unitLength = j["unitLength"];

        for (const e of j["audioSources"]) {
            project.audioSources.push(AudioSource.fromJson(e));
        }
        const jEffects = j["effectRack"] ?? [];
        for (let i = 0; i < jEffects.length; i++) {
            project.effectRack.insert(AudioEffect.fromJson(jEffects[i]), i);
        }
        for (const e of j["patterns"]) {
            project.patterns.push(Pattern.fromJson(e));
        }
        return project;
    }
}

class TimelineItem {
    constructor(className, length = 1) {
        this.elem = document.createElementNS("http://www.w3.org/2000/svg", "g");
        this.elem.classList.add(className);
        this.elem.onclick = (ev) => {
            project.selectPattern(project.patterns.indexOf(this));
        };

        const off = patternHeight * project.patterns.length;
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
        if (this.length > project.longestPattern) {
            project.longestPattern = this.length;
        }
        this.background.setAttribute("width", patternWidth * this.length);
    }

    dispose() {
        this.elem.remove();
    }

    bake(start, end, project) {
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

    registerNote(pitch, velocity, when) {
        const time = ((when - project.ctxStart) % (this.length * project.unitLength)) / this.scaling;
        const note = new Note(pitch, velocity, time, 1000);
        this.notes.push(note);
        this.registering.push(note);
        this.redrawElem();
    }

    finishRegisteringNote(pitch, when) {
        let time = ((when - project.ctxStart) % (this.length * project.unitLength)) / this.scaling;

        this.registering.findIndex(note => note.pitch == pitch);
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

    bake(start, end, project) {
        const loopTime = this.length * project.unitLength;
        const loopStart = project.ctxStart + Math.floor(start / loopTime) * loopTime;
        const wStart = start % loopTime;
        const wEnd = end % loopTime;
        const wrap = wStart > wEnd;

        for (const note of this.notes) {
            const nStart = note.start * this.scaling;
            const nEnd = note.end * this.scaling;
            const ctxNStart = loopStart + nStart;
            const ctxNEnd = loopStart + nEnd;

            if (wrap) {
                if (nStart >= wStart) {
                    this._noteEvent(note, true, ctxNStart);
                }
                else if (nStart < wEnd) {
                    this._noteEvent(note, true, ctxNStart + loopTime);
                }
                if (nEnd >= wStart) {
                    this._noteEvent(note, false, ctxNEnd);
                }
                else if (nEnd < wEnd) {
                    this._noteEvent(note, false, ctxNEnd + loopTime);
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