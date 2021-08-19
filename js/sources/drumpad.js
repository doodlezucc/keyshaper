class DrumPad extends AudioSource {
    constructor() {
        super("drumpad");
        this.triggers = [36, 38, 42, 48];
    }

    createNotePlayer(note, velocity) {
        return null;
    }
}
