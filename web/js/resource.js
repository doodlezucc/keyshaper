localforage.config({
    storeName: "keyshaper",
    version: 1,
});

/** @type {Resource[]} */
const resources = [];
const urlAudioBuffers = {};

class Resource {
    constructor(id, name, value) {
        this.id = id;
        this.value = value;
        this.name = name;
        this.isLoaded = value !== undefined;
    }

    static lookup(id) {
        return resources.find(res => res.id === id);
    }

    async storedValue() {
        if (this.value !== undefined) return this.value;
        return this.load();
    }

    async save() {
        await localforage.setItem(this.id, this.value);
        console.log("Stored blob");
    }

    async load() {
        this.value = await localforage.getItem(this.id);
        console.log("Loaded resource " + this.name);
        return this.value;
    }
}

/**
 * @param {string} url
 * @param {boolean} refresh
 * @returns {Promise<AudioBuffer>}
 */
function loadAudioFromUrl(url, refresh = false) {
    return new Promise((resolve, reject) => {
        if (!refresh && urlAudioBuffers[url]) {
            resolve(urlAudioBuffers[url]);
        }

        const request = new XMLHttpRequest();
        request.onerror = (e) => reject(e);
        request.onload = async () => {
            const buffer = await ctx.decodeAudioData(request.response);
            urlAudioBuffers[url] = buffer;
            resolve(buffer);
        }
        request.responseType = "arraybuffer";
        request.open("GET", url);
        request.send();
    });
}

/**
 * @param {Blob} blob
 */
async function blobToAudioBuffer(blob) {
    return await ctx.decodeAudioData(await blob.arrayBuffer());
}