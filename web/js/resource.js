/** @type {Resource[]} */
const resources = [];
const urlAudioBuffers = {};
const resourceAudioBuffers = {};

localforage.config({
    storeName: "keyshaper",
    version: 1,
});
localforage.iterate((v, k) => {
    resources.push(new Resource(k, v.name, v.value));
});

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

    async safeValue() {
        if (this.value !== undefined) return this.value;
        return this.load();
    }

    async save() {
        await localforage.setItem(this.id, {
            name: this.name,
            value: this.value,
        });
        console.log("Stored resource " + this.name);
    }

    async load() {
        this.value = await localforage.getItem(this.id);
        console.log("Loaded resource " + this.name);
        return this.value;
    }
}

/**
 * @param {Date} d
 */
function dateToFileString(d) {
    pad = function(v) {
        return ("" + v).padStart(2, "0");
    }

    return `${d.getFullYear()}-${pad(d.getMonth())}-${pad(d.getDay())}_` +
        `${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
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
 * @param {Resource} resource
 * @param {boolean} refresh
 * @returns {Promise<AudioBuffer>}
 */
function loadAudioFromResource(resource, refresh = false) {
    return new Promise(async (resolve, reject) => {
        if (!refresh && resourceAudioBuffers[resource]) {
            resolve(resourceAudioBuffers[resource]);
        }

        const blob = await resource.safeValue();
        const arrayBuffer = await blob.arrayBuffer();
        const buffer = await ctx.decodeAudioData(arrayBuffer);
        resourceAudioBuffers[resource] = buffer;
        resolve(buffer);
    });
}

/**
 * @param {Blob} blob
 */
async function blobToAudioBuffer(blob) {
    return await ctx.decodeAudioData(await blob.arrayBuffer());
}

async function openResourceDialog(mimeType, name) {
    const file = await openFileDialog(mimeType);
    if (file) {
        name = name ?? (file.name + file.size);
        const resource = new Resource(name, file.name, new Blob([file]));
        await resource.save();
        return resource;
    }
}

/**
 * @param {string} mimeType
 * @returns {Promise<File>}
 */
function openFileDialog(mimeType) {
    return new Promise((resolve, reject) => {
        /** @type {HTMLInputElement} */
        const uploadInput = document.getElementById("fileUpload");

        uploadInput.oninput = () => {
            if (uploadInput.files.length > 0) {
                resolve(uploadInput.files.item(0));
            }

        }

        uploadInput.click();
    });
}