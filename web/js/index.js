const sampleRate = 44100;

/** @type {Project} */
let project;

let isInitialized = false;
let recordOnInput = false;

/** @type {AudioSource} */
let src;

document.onkeydown = async (ev) => {
    onUserGesture();

    if (ev.target instanceof HTMLInputElement) return;

    if (ev.key == " ") {
        if (project.unitLength == 1000 && !project.isPaused && project.timelineItems.length == 1) {
            project.calculateFirstUnitLength();
        } else {
            if (project.isPaused) {
                project.play();
            } else {
                project.pause();
            }
        }
    } else if (ev.ctrlKey) {
        switch (ev.key) {
            case "s":
                project.save("project");
                return ev.preventDefault();
            case "l":
                Project.load("project");
                return ev.preventDefault();
        }
    } else {
        switch (ev.key) {
            case "Backspace":
                project.activeLoop.removeCurrentItem();
                return ev.preventDefault();
            case "o":
                return project.audioSources.push(new Oscillator());
            case "d":
                return project.audioSources.push(new DrumPad());
            case "r":
                return project.mixer.selected.append(new Reverb());
            case "p":
                project.activeLoop.patterns.push(new Pattern(project.audioSources.length - 1, 2));
                return project.activeLoop.selectItem(project.activeLoop.patterns.length - 1);
            case "R":
                if (!project.recorder.isRecording) {
                    const index = 0;
                    console.log("Recording device " + project.recorder.inputs[index].label);
                    const rec = await project.recorder.startRecording(index);
                    project.activeLoop.clips.push(rec);
                } else {
                    project.recorder.stopRecording();
                }
                return;
            case "i":
                recordOnInput = !recordOnInput;
                return console.log("Record on input: " + recordOnInput);
            case "C":
                if (project.isPaused) {
                    const device = project.recorder.inputs[0];
                    console.log("Calibrating " + device.label);
                    await Calibration.runCalibration(device, 24);
                    Calibration.saveLatencies();
                }
                return;
        }

        if (ev.key.match(/\d/)) {
            const parsed = parseInt(ev.key) - 1;
            if (project.activeLoopIndex == parsed) {
                const loop = project.activeLoop;
                loop.enabled = !loop.enabled;
                console.log("Set loop " + parsed + " enabled: " + loop.enabled);
            } else {
                project.activeLoopIndex = parsed;
                project.activeLoop.enabled = true;
                console.log("Editing loop " + parsed);
            }
        }
    }
}

navigator.requestMIDIAccess().then(onMIDISuccess, onMIDIFailure);

function onMIDIFailure() {
    console.log('Could not access your MIDI devices.');
}

function onMIDISuccess(midiAccess) {
    for (var input of midiAccess.inputs.values()) {
        input.onmidimessage = getMIDIMessage;
    }

    midiAccess.onstatechange = (ev) => {
        ev.port.onmidimessage = getMIDIMessage;
    };
}

function getMIDIMessage(midiMessage) {
    // console.log(midiMessage.data);

    if (recordOnInput && project.isPaused) {
        project.isRecording = true;
        project.play();
    }
    if (src) {
        src.midi(midiMessage.data);
    }
}

async function onUserGesture() {
    if (isInitialized) return;
    isInitialized = true;

    ctx = new AudioContext({
        sampleRate: sampleRate
    });
    ctx.resume();

    project = new Project();
    // project.test();

    setTimeout(() => {
        // project.play();
    }, 1000);
}

function initSelect(selectId, emptyOptionName, lookup, cb) {
    const select = document.getElementById(selectId);
    const emptyOption = document.createElement("option");
    emptyOption.value = "";
    emptyOption.innerHTML = emptyOptionName;
    select.append(emptyOption);

    for (const key in lookup) {
        const option = document.createElement("option");
        option.value = key;
        option.innerHTML = titleCase(key);
        select.append(option);
    }
    select.oninput = () => {
        const key = select.value;
        cb(lookup[key]());
        select.value = "";
    }
}

function initSelects() {
    initSelect("addEffect", "Add Effect...", effectLookup, e => {
        project.mixer.selected.append(e);
    });
    initSelect("addSource", "Add Audio Source...", sourceLookup, e => project.audioSources.push(e));
}

/**
 * Capitalizes the first letter of each word of `s`.
 * @param {string} s
 * @returns {string}
 */
function titleCase(s) {
    return s.toLowerCase().split(" ").map(w => w.charAt(0).toUpperCase() + w.substring(1)).join(" ");
}

window.onload = () => {
    initSelects();
    document.getElementById("mixerTrackSelector").oninput = function() {
        project.mixer.selectedIndex = this.value;
    }
    document.getElementById("render").onclick = async function() {
        this.disabled = true;
        await project.render();
        this.disabled = false;
    }
}