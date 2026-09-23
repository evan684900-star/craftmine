'use strict';
// Effets sonores synthétisés avec WebAudio (aucun fichier audio).
(function () {
  const A = (CM.Audio = { ctx: null, master: null, volume: 0.5, noise: null });

  A.init = function () {
    if (A.ctx) {
      if (A.ctx.state === 'suspended') A.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    A.ctx = new AC();
    A.master = A.ctx.createGain();
    A.master.gain.value = A.volume;
    A.master.connect(A.ctx.destination);
    const len = A.ctx.sampleRate;
    A.noise = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
    const d = A.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  };
  A.setVolume = function (v) {
    A.volume = v;
    if (A.master) A.master.gain.value = v;
  };

  function envGain(t, attack, decay, peak) {
    const g = A.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    g.connect(A.master);
    return g;
  }
  function noise(t, dur, type, freq, q, peak, freqEnd) {
    const src = A.ctx.createBufferSource();
    src.buffer = A.noise;
    const f = A.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    f.Q.value = q;
    src.connect(f);
    f.connect(envGain(t, 0.005, dur, peak));
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }
  function tone(t, dur, type, f0, f1, peak, attack) {
    const o = A.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    o.connect(envGain(t, attack || 0.005, dur, peak));
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  const MAT = {
    stone: ['bandpass', 1500, 1.2],
    wood: ['bandpass', 520, 1.5],
    grass: ['highpass', 2400, 0.7],
    sand: ['bandpass', 1100, 0.6],
    gravel: ['bandpass', 800, 0.8],
    glass: ['highpass', 3200, 1.0],
  };

  A.play = function (name, opt) {
    if (!A.ctx || A.volume <= 0) return;
    const t = A.ctx.currentTime + 0.001;
    opt = opt || {};
    const m = MAT[opt.mat] || MAT.stone;
    const pitch = opt.pitch || 1;
    switch (name) {
      case 'dig':
        noise(t, 0.06, m[0], m[1] * pitch, m[2], 0.18);
        break;
      case 'break':
        noise(t, 0.16, m[0], m[1] * pitch, m[2], 0.35);
        if (opt.mat === 'wood') tone(t, 0.1, 'sine', 140, 80, 0.25);
        if (opt.mat === 'glass') tone(t, 0.25, 'triangle', 2400, 1200, 0.12);
        break;
      case 'place':
        noise(t, 0.08, m[0], m[1] * 0.8, m[2], 0.3);
        tone(t, 0.06, 'sine', 180, 90, 0.15);
        break;
      case 'step':
        noise(t, 0.045, m[0], m[1] * (0.8 + Math.random() * 0.4), m[2], 0.07);
        break;
      case 'hurt':
        tone(t, 0.18, 'square', 320, 110, 0.12);
        break;
      case 'hit':
        noise(t, 0.08, 'lowpass', 900, 1, 0.3);
        tone(t, 0.08, 'sine', 160, 70, 0.25);
        break;
      case 'pop':
        tone(t, 0.07, 'sine', 700 + Math.random() * 200, 1400, 0.12);
        break;
      case 'grapple':
        noise(t, 0.25, 'bandpass', 500, 2, 0.25, 2600);
        tone(t + 0.2, 0.05, 'square', 900, 600, 0.08);
        break;
      case 'dash':
        noise(t, 0.22, 'bandpass', 2400, 1.2, 0.3, 500);
        break;
      case 'jump2':
        tone(t, 0.16, 'sine', 400, 900, 0.12);
        noise(t, 0.12, 'highpass', 3000, 0.5, 0.08);
        break;
      case 'combo':
        tone(t, 0.12, 'triangle', 440 * Math.pow(2, Math.min(opt.level || 1, 12) / 12), 0, 0.12);
        break;
      case 'level':
        [523, 659, 784, 1046].forEach((f, i) => tone(t + i * 0.08, 0.18, 'triangle', f, 0, 0.15));
        break;
      case 'objective':
        [392, 523, 659].forEach((f, i) => tone(t + i * 0.1, 0.25, 'sine', f, 0, 0.15));
        break;
      case 'eat':
        for (let i = 0; i < 3; i++) noise(t + i * 0.09, 0.06, 'bandpass', 900 + Math.random() * 400, 1, 0.2);
        break;
      case 'craft':
        noise(t, 0.05, 'bandpass', 1400, 1.5, 0.2);
        noise(t + 0.08, 0.05, 'bandpass', 1800, 1.5, 0.2);
        break;
      case 'shadow':
        tone(t, 0.5, 'sawtooth', 90, 55, 0.08, 0.05);
        break;
      case 'shadow_hurt':
        tone(t, 0.2, 'sawtooth', 200, 90, 0.1);
        break;
      case 'baa':
        tone(t, 0.35, 'sawtooth', 330, 300, 0.05, 0.03);
        break;
      case 'bounce':
        tone(t, 0.2, 'sine', 180, 520, 0.2);
        break;
      case 'splash':
        noise(t, 0.3, 'lowpass', 1200, 0.7, 0.25, 300);
        break;
      case 'victory':
        [523, 659, 784, 1046, 1318].forEach((f, i) => tone(t + i * 0.12, 0.6, 'triangle', f, 0, 0.14));
        break;
      case 'click':
        tone(t, 0.03, 'square', 1200, 800, 0.05);
        break;
      case 'burn':
        noise(t, 0.2, 'highpass', 1800, 0.5, 0.08);
        break;
    }
  };
})();
