const playEntireSamples = true;

class DrumPad extends AudioSource {
    constructor() {
        super("drumpad");
        this.triggers = [36, 38, 42, 46];

        /** @type {AudioBuffer[]} */
        this.buffers = [];
        this.loadAudio(0, "resources/drums/eternitykick5.wav");
        this.loadAudio(1, "resources/drums/eternitysnare9.wav");
        this.loadAudio(2, "resources/drums/eternityhihatc6.wav");
        this.loadAudio(3, "resources/drums/eternityhihato4.wav");
    }

    loadAudio(slot, url) {
        const request = new XMLHttpRequest();
        request.onload = async (ev) => {
            this.buffers[slot] = await ctx.decodeAudioData(request.response);
            console.log("Loaded sample in slot " + slot);
        }
        request.responseType = "arraybuffer";
        request.open("GET", url);
        request.send();
    }

    createNotePlayer(note, velocity, start) {
        for (let i = 0; i < this.triggers.length; i++) {
            const trigger = this.triggers[i];

            if (note == trigger) {
                const sourceNode = ctx.createBufferSource();
                const buffer = this.buffers[i];
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
}

registerSource("drumpad", () => new DrumPad());