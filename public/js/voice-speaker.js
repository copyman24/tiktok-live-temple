// "Only one page speaks" for the prayer stage (shared live-core election, served at /live-core/).
//
// - OBS pages (?obs=1) are stages: the most recently opened one reads the prayers aloud.
// - The operator page (no ?obs=1) speaks only while no OBS page is open, so opening the
//   dashboard next to OBS never doubles the voice, and rehearsing without OBS still has sound.
// A silenced page keeps its animation timing: enqueueTts behaves as if TTS were switched off.
import { joinSpeakerElection } from '/live-core/voice.js';

const isObs = new URLSearchParams(location.search).get('obs') === '1';
window.__templeVoiceAllowed = isObs; // until the server answers

const Engine = window.TempleAudioEngine;
if (Engine && !Engine.prototype.__speakerGate) {
  const enqueue = Engine.prototype.enqueueTts;
  Engine.prototype.enqueueTts = function gatedEnqueueTts(text, options = {}) {
    if (window.__templeVoiceAllowed !== false) return enqueue.call(this, text, options);
    if (typeof options.onStart === 'function') options.onStart();
    if (typeof options.onEnd === 'function') setTimeout(options.onEnd, 5500);
  };
  Engine.prototype.__speakerGate = true;
}

joinSpeakerElection({
  path: isObs ? '/ws?role=stage' : '/ws?role=monitor',
  onChange(isSpeaker, stages) {
    window.__templeVoiceAllowed = isObs ? isSpeaker : stages === 0;
  }
});
