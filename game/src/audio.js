// Sound, synthesized live with WebAudio: no audio files, no network, just a few
// oscillators. The alarm siren rises with the meter; pickups chime; a catch stings.
export function createAudio() {
  let ctx = null;
  let siren = null;
  let sirenGain = null;

  function ensure() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext ?? window.webkitAudioContext;
      ctx = new AC();
    } catch {
      ctx = null;
    }
    return ctx;
  }

  function blip(freq, dur, type, vol, when = 0) {
    const ac = ensure();
    if (!ac) return;
    const t = ac.currentTime + when;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function pickup() {
    blip(880, 0.09, 'sine', 0.12);
    blip(1318, 0.14, 'sine', 0.1, 0.07);
  }
  function spotted() {
    blip(220, 0.16, 'square', 0.08);
    blip(185, 0.2, 'square', 0.08, 0.12);
  }
  function laser() {
    blip(1400, 0.08, 'sawtooth', 0.07);
  }
  function emp() {
    blip(90, 0.35, 'sine', 0.16);
    blip(60, 0.4, 'sine', 0.12, 0.08);
  }
  function win() {
    [523, 659, 784, 1046].forEach((f, i) => blip(f, 0.22, 'triangle', 0.12, i * 0.11));
  }
  function lose() {
    [330, 262, 196].forEach((f, i) => blip(f, 0.3, 'sawtooth', 0.08, i * 0.16));
  }

  /** Keep the siren's volume following the alarm meter (0..1). */
  function setAlarm(level) {
    const ac = ensure();
    if (!ac) return;
    if (!siren) {
      siren = ac.createOscillator();
      siren.type = 'sawtooth';
      siren.frequency.setValueAtTime(620, ac.currentTime);
      sirenGain = ac.createGain();
      sirenGain.gain.setValueAtTime(0, ac.currentTime);
      siren.connect(sirenGain);
      sirenGain.connect(ac.destination);
      siren.start();
      // Wail: the siren's pitch slowly rises and falls.
      const lfo = ac.createOscillator();
      lfo.frequency.setValueAtTime(0.7, ac.currentTime);
      const lfoGain = ac.createGain();
      lfoGain.gain.setValueAtTime(180, ac.currentTime);
      lfo.connect(lfoGain);
      lfoGain.connect(siren.frequency);
      lfo.start();
    }
    sirenGain.gain.setTargetAtTime(level > 0.35 ? 0.02 + level * 0.05 : 0, ac.currentTime, 0.2);
  }

  function resume() {
    const ac = ensure();
    if (ac && ac.state === 'suspended') void ac.resume();
  }

  return { pickup, spotted, laser, emp, win, lose, setAlarm, resume };
}
