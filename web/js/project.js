const frameLength = 60;

const patternWidth = 300;
const patternHeight = 100;

const timelineCursor = document.getElementById("timelineCursor");

class Project {
    constructor() {
        this.unitLength = 16 * 0.1875;

        /** @type {AudioSource[]} */
        this.audioSources = [];

        /** @type {Pattern[]} */
        this.patterns = [];
        this.currentPattern = 0;
        this.ctxStart = 0;
        this.lastFrame = -1;
        this.isRecording = true;

        this.isPaused = true;
        setInterval(() => {
            if (!this.isPaused) {
                this.bake();
            }
        }, frameLength - 5);

        this.longestPattern = 1;
        this.redrawTimelineGuides();

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
        timelineCursor.setAttribute("x1", 0);
        timelineCursor.setAttribute("x2", 0);
    }

    bake() {
        const time = ctx.currentTime - this.ctxStart;
        const currentStep = (time * 1000) / frameLength;
        while (currentStep >= this.lastFrame) {
            this.lastFrame++;
            // console.log("Baking audio frame " + this.lastFrame);

            const start = this.lastFrame * frameLength / 1000;
            const end = start + frameLength / 1000;

            for (const pattern of this.patterns) {
                pattern.bake(start, end, this);
            }
        }
    }

    test() {
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

        const oscPattern = new Pattern(1);
        oscPattern.length = 2;
        oscPattern.redrawElem();
        this.patterns.push(oscPattern);
        this.currentPattern = 1;
    }

    dispose() {
        for (const source of this.audioSources) {
            source.dispose();
        }
        for (const pattern of this.patterns) {
            pattern.dispose();
        }
        this.isPaused = true;
    }

    save(name) {
        const obj = {
            "audioSources": this.audioSources.map(e => e.toJson()),
            "patterns": this.patterns.map(e => e.toJson()),
        };
        console.log(obj);
        if (!name) {
            name = window.prompt("Enter a project name");
        }
        window.localStorage.setItem(name, JSON.stringify(obj));
    }

    static load(name) {
        const j = JSON.parse(window.localStorage.getItem(name));
        console.log(j);
        const project = new Project();
        for (const e of j["audioSources"]) {
            project.audioSources.push(AudioSource.fromJson(e));
        }
        for (const e of j["patterns"]) {
            project.patterns.push(Pattern.fromJson(e));
        }
        return project;
    }
}

class Pattern {
    constructor(audioSourceIndex, length = 1) {
        this.elem = document.createElementNS("http://www.w3.org/2000/svg", "g");

        const off = patternHeight * project.patterns.length;
        this.elem.setAttribute("transform", "translate(0, " + off + ")");

        this.background = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        this.background.setAttribute("height", patternHeight);
        this.background.classList.add("pattern-background");
        this.elem.append(this.background);

        this.audioSourceIndex = audioSourceIndex;

        this.length = length;
        /** @type {Note[]} */
        this.notes = [];

        this.scaling = 1;

        this.redrawElem();
        document.getElementById("timeline").prepend(this.elem);
    }

    /** @type {AudioSource} */
    get audioSource() {
        return project.audioSources[this.audioSourceIndex];
    }

    registerNote(pitch, velocity, when) {
        const time = ((when - project.ctxStart) % (this.length * project.unitLength)) / this.scaling;
        this.notes.push(new Note(pitch, velocity, time, 0.1));
        this.redrawElem();
    }

    dispose() {
        this.elem.remove();
    }

    redrawElem() {
        if (this.length > project.longestPattern) {
            project.longestPattern = this.length;
        }
        this.background.setAttribute("width", patternWidth * this.length);

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
                rect.setAttribute("y", h * (1 - (note.pitch - min + 1) / yDelta));
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
            const when = loopStart + nStart;

            if (wrap) {
                if (nStart >= wStart) {
                    this._noteEvent(note, true, when);
                }
                else if (nStart < wEnd) {
                    this._noteEvent(note, true, when + loopTime);
                }
                if (nEnd >= wStart) {
                    this._noteEvent(note, false, when);
                }
                else if (nEnd < wEnd) {
                    this._noteEvent(note, false, when + loopTime);
                }
            } else {
                if (nStart >= wStart && nStart < wEnd) {
                    this._noteEvent(note, true, when);
                }
                if (nEnd >= wStart && nEnd < wEnd) {
                    this._noteEvent(note, false, when);
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