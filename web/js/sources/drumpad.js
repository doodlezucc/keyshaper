const playEntireSamples = true;
const preloadBuffers = true;

class DrumPad extends AudioSource {
    constructor() {
        super("drumpad");

        /** @type {DrumPadSlot[]} */
        this.slots = [];
        this.resetToDefaults();
    }

    resetToDefaults() {
        this.slots.push(
            new DrumPadSlot(this, "Kick", 36, "resources/drums/eternitykick5.wav"),
            new DrumPadSlot(this, "Snare", 38, "resources/drums/eternitysnare9.wav"),
            new DrumPadSlot(this, "Closed Hi-Hat", 42, "resources/drums/eternityhihatc6.wav"),
            new DrumPadSlot(this, "Open Hi-Hat", 46, "resources/drums/eternityhihato4.wav"),
        )
    }

    createNotePlayer(note, velocity, start) {
        for (const slot of this.slots) {

            if (note == slot.trigger) {
                const sourceNode = ctx.createBufferSource();
                const buffer = slot.buffer;
                sourceNode.buffer = buffer;

                const gainNode = ctx.createGain();
                gainNode.gain.value = velocity;

                sourceNode.connect(gainNode);
                sourceNode.start(start);

                return new PlayingNote(gainNode,
                    (amount) => { }, // Unhandled pitch bending
                    (when) => new Promise((resolve) => {
                        if (playEntireSamples) {
                            // Prevent instant node disconnect
                            setTimeout(resolve, 1000 * (when - ctx.currentTime + buffer.duration));
                        } else {
                            resolve();
                        }
                    }));
            }
        }
    }

    paramsToJson() {
        return {
            "slots": this.slots.map(slot => slot.toJson()),
        };
    }

    paramsFromJson(j) {
        try {
            this.slots.slice().forEach(slot => slot.remove());
            this.slots = j["slots"].map(j => DrumPadSlot.fromJson(this, j));
        } catch (error) {
            console.error(error);
        }
    }
}

class DrumPadSlot {
    #audio;

    /**
     * @param {DrumPad} drumPad
     * @param {string} name
     * @param {number} trigger
     * @param {Resource|string} audio
     */
    constructor(drumPad, name, trigger, audio) {
        this.drumPad = drumPad;
        this.name = name;
        this.trigger = trigger;
        this.audio = audio;

        this.elem = document.createElement("span");
        const btn = document.createElement("button");
        btn.textContent = name;
        btn.onclick = () => {
            drumPad._noteOn(trigger, 1, ctx.currentTime, project.isRecording);
            drumPad._noteOff(trigger, ctx.currentTime + .01, project.isRecording);
        }
        const edit = document.createElement("button");
        edit.textContent = "*";
        edit.onclick = async () => {
            const resource = await openResourceDialog("audio/*");
            this.audio = resource;
            btn.textContent = resource.name;
            console.log("changed audio");
        }
        this.elem.append(btn);
        this.elem.append(edit);
        drumPad.controls.elem.appendChild(this.elem);
    }

    static fromJson(drumPad, json) {
        const audio = json["audio"];
        return new DrumPadSlot(
            drumPad,
            json["name"],
            json["trigger"],
            json["isUrlAudio"] ? audio : Resource.lookup(audio),
        );
    }

    toJson() {
        const audioId = (this.audio instanceof Resource) ? this.audio.id : this.audio;

        return {
            "name": this.name,
            "trigger": this.trigger,
            "audio": audioId,
            "isUrlAudio": this.isUrlAudio,
        };
    }

    remove() {
        this.elem.remove();
        this.drumPad.slots = this.drumPad.slots.filter(slot => slot != this);
    }

    get audio() { return this.#audio; }
    set audio(audio) {
        this.#audio = audio;
        this.buffer = undefined;
        if (preloadBuffers) this.loadAudioBuffer();
    }

    get isUrlAudio() {
        return !(this.audio instanceof Resource);
    }

    async loadAudioBuffer() {
        if (!this.buffer) {
            console.log(this.audio)
            if (this.audio instanceof Resource) {
                const blob = await this.audio.safeValue();
                this.buffer = await blobToAudioBuffer(blob);
            } else {
                this.buffer = await loadAudioFromUrl(this.audio);
            }
        }
        return this.buffer;
    }
}

registerSource("drumpad", () => new DrumPad());