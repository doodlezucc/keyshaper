class DrumPad extends AudioSource {
    constructor() {
        super("drumpad");
        this.triggers = [36, 38, 42, 48];
        this.buffers = [];
        this.loadAudio(0, "resources/drums/eternitykick5.wav");
        this.loadAudio(0, "resources/drums/eternitysnare9.wav");
        this.loadAudio(0, "resources/drums/eternityhihatc6.wav");
        this.loadAudio(0, "resources/drums/eternityhihato4.wav");
    }

    loadAudio(slot, url) {
        const request = new XMLHttpRequest();
        request.onload = (ev) => {
            console.log((100 * ev.loaded / ev.total).toFixed(1) + "%");
            console.log(request.response);
            this.buffers[slot] = ctx.decodeAudioData(request.response);
        }
        request.open("GET", url);
        request.send();
    }

    createNotePlayer(note, velocity) {
        return null;
    }
}
