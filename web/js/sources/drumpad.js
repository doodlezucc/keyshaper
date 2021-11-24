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
            new DrumPadSlot("Kick", 36, "resources/drums/eternitykick5.wav"),
            new DrumPadSlot("Snare", 38, "resources/drums/eternitysnare9.wav"),
            new DrumPadSlot("Closed Hi-Hat", 42, "resources/drums/eternityhihatc6.wav"),
            new DrumPadSlot("Open Hi-Hat", 46, "resources/drums/eternityhihato4.wav"),
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
        this.slots.length = 0;
        this.slots.push(j["slots"].map(j => DrumPadSlot.fromJson(j)));
    }
}

class DrumPadSlot {
    #audio;

    /**
     * @param {string} name
     * @param {number} trigger
     * @param {Resource|string} audio
     */
    constructor(name, trigger, audio) {
        this.name = name;
        this.trigger = trigger;
        this.audio = audio;
    }

    static fromJson(json) {
        const audio = json["audio"];
        return new DrumPadSlot(
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

    get audio() { return this.#audio; }
    set audio(audio) {
        this.#audio = audio;
        this.buffer = undefined;
        if (preloadBuffers) this.loadAudioBuffer();
    }

    get isUrlAudio() {
        return !(audio instanceof Resource);
    }

    async loadAudioBuffer() {
        console.log("load");
        if (!this.buffer) {
            console.log(this.audio)
            if (this.audio instanceof Resource) {
                const blob = await this.audio.storedValue();
                this.buffer = blobToAudioBuffer(blob);
            } else {
                console.log("ha lol");
                this.buffer = await loadAudioFromUrl(this.audio);
            }

            if (this.buffer) console.log("Loaded buffer for " + this.name);
        }
        return this.buffer;
    }
}

registerSource("drumpad", () => new DrumPad());