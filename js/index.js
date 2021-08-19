let time1 = 0;
let time2 = 0;

const src = new Oscillator();

window.onkeydown = (ev) => {
    time1 = Date.now();
    ctx.resume();
    //console.log(time1);
}

navigator.requestMIDIAccess().then(onMIDISuccess, onMIDIFailure);

function onMIDIFailure() {
    console.log('Could not access your MIDI devices.');
}

function onMIDISuccess(midiAccess) {
    for (var input of midiAccess.inputs.values()) {
        input.onmidimessage = getMIDIMessage;
    }
}

function getMIDIMessage(midiMessage) {
    console.log(midiMessage.data);
    time2 = Date.now();
    //console.log(time2 - time1);
    src.midi(midiMessage.data);
}
