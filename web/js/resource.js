localforage.config({
    storeName: "keyshaper",
    version: 1,
});

/** @type {Resource[]} */
const resources = [];

class Resource {
    constructor(id, name, value) {
        this.id = id;
        this.value = value;
        this.name = name;
        this.isLoaded = value !== undefined;
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
