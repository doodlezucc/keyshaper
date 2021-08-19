const sampleRate = 44100;

let time1 = 0;
let time2 = 0;
let isInitialized = false;

/** @type {AudioSource} */
let src;

window.onkeydown = (ev) => {
    time1 = Date.now();
    //console.log(time1);
    onUserGesture();
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
    await ctx.resume();

    src = new Oscillator();
}