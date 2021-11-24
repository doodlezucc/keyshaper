class Mixer {
    #index;

    constructor() {
        this.master = new MixerTrack();
        this.#index = -1;

        /** @type {MixerTrack[]} */
        this.tracks = [
            this.#createTrack(),
            this.#createTrack(),
            this.#createTrack(),
            this.#createTrack(),
        ];
    }

    get selectedIndex() {
        return this.#index;
    }
    set selectedIndex(v) {
        this.#index = v;
        document.querySelector("style").innerText = "#effects > [track=\"" + v + "\"] { display: inherit; }";
    }

    get selected() {
        return this.selectedIndex >= 0 ? this.tracks[this.selectedIndex] : this.master;
    }

    get allTracks() {
        return this.tracks.concat(this.master);
    }

    trackAt(index) {
        if (index >= 0) return this.tracks[index];
        return this.master;
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
    /**
     * @param {AudioEffect} effect
     * @param {number} index
     */
    insert(effect, index) {
        super.insert(effect, index);
        effect.controls.updateTrack(project.mixer.tracks.indexOf(this));
    }
}