const sampleRate = 44100;

/** @type {Project} */
let project;

let time1 = 0;
let time2 = 0;
let isInitialized = false;
let recordOnInput = false;

/** @type {AudioSource} */
let src;

document.onkeydown = (ev) => {
    time1 = Date.now();
    //console.log(time1);
    onUserGesture();

    if (ev.target instanceof HTMLInputElement) return;

    if (ev.key == " ") {
        if (project.unitLength == 1000 && !project.isPaused && project.patterns.length == 1) {
            project.unitLength = ctx.currentTime - project.ctxStart;
            let bpm = 4 * 60 / project.unitLength;
            while (bpm < 70) {
                project.unitLength /= 2;
                bpm *= 2;
                project.patterns[0].length *= 2;
            }
            project.redrawTimelineGuides();
            project.patterns[0].redrawElem();

            console.log("Set unit length to " + project.unitLength.toFixed(3) + " seconds, " + bpm.toFixed(1) + " BPM");
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
                project.dispose();
                project = Project.load("project");
                return ev.preventDefault();
        }
    } else {
        switch (ev.key) {
            case "Backspace":
                project.removeCurrentPattern();
                return ev.preventDefault();
            case "o":
                return project.audioSources.push(new Oscillator());
            case "d":
                return project.audioSources.push(new DrumPad());
            case "r":
                return project.effectRack.append(new Reverb());
            case "p":
                project.patterns.push(new Pattern(project.audioSources.length - 1, 2));
                return project.selectPattern(project.patterns.length - 1);
            case "i":
                recordOnInput = !recordOnInput;
                return console.log("Record on input: " + recordOnInput);
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
    console.log(midiMessage.data);
    time2 = Date.now();
    //console.log(time2 - time1);

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
    project.test();

    // src = new DrumPad();
    // project.audioSources.push(src);
    setTimeout(() => {
        // project.play();
    }, 1000);
}