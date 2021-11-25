class Loop {
    #enabled;

    constructor() {
        this.length = 1;
        this.#enabled = true;
        this.currentItem = 0;

        /** @type {Pattern[]} */
        this.patterns = [];

        /** @type {Clip[]} */
        this.clips = [];
    }

    get enabled() { return this.#enabled; }
    set enabled(v) {
        this.#enabled = v;
        if (!v) {
            this.onPause();
        }
    }

    get timelineItems() {
        return this.patterns.concat(this.clips);
    }

    selectItem(index) {
        this.currentItem = Math.max(index, 0);
        src = this.timelineItems[this.currentItem].audioSource;
        console.log("Selected timeline item " + this.currentItem);
    }

    removeCurrentItem() {
        if (this.timelineItems.length) {
            const item = this.timelineItems[this.currentItem];
            item.dispose();

            if (item instanceof Pattern) {
                this.patterns = this.patterns.filter(p => p != item);
            } else {
                this.clips = this.clips.filter(c => c != item);
            }

            if (this.timelineItems.length) {
                this.selectItem(this.currentItem - 1);
            } else {
                if (!project.timelineItems.length) {
                    project.zeroItemsEvent();
                }
            }
        }
    }

    bake(start, end) {
        if (this.enabled) {
            for (const item of this.timelineItems) {
                item.bake(start, end, this);
            }
        }
    }

    onPause() {
        for (const pattern of this.patterns) {
            pattern.audioSource.onBlur(ctx.currentTime);
        }
        for (const c of this.clips) {
            c.cancel(ctx.currentTime);
        }
    }

    toJson() {
        return {
            "length": this.length,
            "enabled": this.enabled,
            "patterns": this.patterns.map(e => e.toJson()),
            "clips": this.clips.map(e => e.toJson()),
        }
    }

    async fromJson(j) {
        this.length = j["length"];
        this.enabled = j["enabled"];
        for (const e of j["patterns"]) {
            this.patterns.push(Pattern.fromJson(e));
        }
        for (const e of j["clips"]) {
            this.clips.push(await Clip.fromJson(e));
        }
    }
}