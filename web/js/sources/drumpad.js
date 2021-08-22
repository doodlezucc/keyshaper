class DrumPad extends AudioSource {
    constructor() {
        super("drumpad");
        this.triggers = [36, 38, 42, 46];
        this.buffers = [];
        this.loadAudio(0, "resources/drums/eternitykick5.wav");
        this.loadAudio(1, "resources/drums/eternitysnare9.wav");
        this.loadAudio(2, "resources/drums/eternityhihatc6.wav");
        this.loadAudio(3, "resources/drums/eternityhihato4.wav");
    }

    loadAudio(slot, url) {
        const request = new XMLHttpRequest();
        request.onload = async (ev) => {
            console.log((100 * ev.loaded / ev.total).toFixed(1) + "%");
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
                console.log(note + " at " + start);
                const sourceNode = ctx.createBufferSource();
                sourceNode.buffer = this.buffers[i];

                const gainNode = ctx.createGain();
                gainNode.gain.value = velocity;

                sourceNode.connect(gainNode);
                sourceNode.start(start);

                return new PlayingNote(gainNode,
                    (amount) => { }, // Unhandled pitch bending
                    () => { }); // Prevent node disconnect
            }
        }
    }
}
