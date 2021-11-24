class Mixer {
    constructor() {
        this.master = new MixerTrack();
        this.selectedIndex = 0;

        /** @type {MixerTrack[]} */
        this.tracks = [
            this.#createTrack(),
            this.#createTrack(),
            this.#createTrack(),
            this.#createTrack(),
        ];

    }

    get selected() {
        return this.tracks[this.selectedIndex];
    }

    get allTracks() {
        return this.tracks.concat(this.master);
    }

    #createTrack() {
        const track = new MixerTrack();
        track.chainEnd.connect(this.master.chainStart);
        return track;
    }

    toJson() {
        return {
            "master": this.master.effects.map(e => e.toJson()),
            "tracks": this.tracks.map(t => t.effects.map(e => e.toJson())),
        };
    }

    fromJson(j) {
        for (const jfx of j["master"]) {
            this.master.append(AudioEffect.fromJson(jfx));
        }
        const tracks = j["tracks"];
        for (let i = 0; i < tracks.length; i++) {
            for (const jfx of tracks[i]) {
                this.tracks[i].append(AudioEffect.fromJson(jfx));
            }
        }
    }
}

class MixerTrack extends EffectRack {

}