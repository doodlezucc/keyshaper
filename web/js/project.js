const frameLength = 60;

class Project {
    constructor() {
        this.unitLength = 16 * 0.1875;
        /** @type {Pattern[]} */
        this.patterns = [];

        this.ctxStart = 0;
        this.lastFrame = -1;
        this.isPaused = true;
        setInterval(() => {
            if (!this.isPaused) {
                this.bake();
            }
        }, frameLength - 10);
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
            pattern.audioSource.onBlur();
        }
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
        const drumPattern = new Pattern(new DrumPad());
        drumPattern.notes = [
            new Note(36, 1, 0, 1),
            new Note(38, 1, 4, 1),
            new Note(38, 0.6, 7, 1),
            new Note(38, 0.8, 9, 1),
            new Note(36, 1, 10, 1),
            new Note(38, 1, 12, 1),
            new Note(36, 1, 13, 1),
            new Note(42, 0.7, 14, 1),
            new Note(42, 1, 15, 1),
        ];
        this.patterns.push(drumPattern);
    }
}

class Pattern {
    constructor(audioSource, length = 1) {
        /** @type {AudioSource} */
        this.audioSource = audioSource;

        this.length = length;
        /** @type {Note[]} */
        this.notes = [];

        this.scaling = 0.1875;
    }

    bake(start, end, project) {
        const loopTime = this.length * project.unitLength;
        const wStart = start % loopTime;
        const wEnd = end % loopTime;
        const wrap = wStart > wEnd;
        let loopStart = project.ctxStart + Math.floor(start / loopTime) * loopTime;

        if (wrap) {
            console.log("wrap lööp");
        }

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
}