'use strict';
// Effets sonores synthétisés avec WebAudio (aucun fichier audio).
(function () {
  const A = (CM.Audio = { ctx: null, master: null, volume: 0.5, noise: null, cat: { sfx: 1, mob: 1, ui: 1 } });
  let MUL = 1; // volume de la catégorie du son en cours
  const MOB_SOUNDS = new Set(['shadow', 'shadow_hurt', 'grunt', 'squeak', 'baa', 'hmm', 'golem', 'cluck', 'moo', 'hiss', 'skitter', 'rattle', 'squish', 'growl']);
  const UI_SOUNDS = new Set(['click', 'craft', 'level', 'objective', 'victory', 'pop', 'note', 'xp', 'enchant']);

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
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak * MUL), t + attack);
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
    wool: ['lowpass', 700, 0.6],
    metal: ['bandpass', 2600, 4],
  };

  A.mute = 0; // > 0 : simulation d'une autre dimension (rien à entendre ici)
  A.play = function (name, opt) {
    if (!A.ctx || A.volume <= 0 || A.mute > 0) return;
    MUL = MOB_SOUNDS.has(name) ? A.cat.mob : UI_SOUNDS.has(name) ? A.cat.ui : A.cat.sfx;
    if (MUL <= 0.001) return;
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
      case 'fizz':
        // flamme éteinte : petit souffle
        noise(t, 0.25, 'highpass', 1800, 0.6, 0.22, 700);
        break;
      case 'zap':
        noise(t, 0.18, 'highpass', 2500, 0.7, 0.25);
        tone(t, 0.15, 'sawtooth', 1400, 200, 0.08);
        break;
      case 'laser':
        tone(t, 0.18, 'sawtooth', 1800, 300, 0.09);
        tone(t, 0.12, 'square', 900, 1500, 0.04);
        break;
      case 'shield':
        // coup arrêté par le bouclier : choc sourd de bois et de métal
        noise(t, 0.12, 'lowpass', 700, 1, 0.35);
        tone(t, 0.1, 'triangle', 220, 120, 0.2);
        tone(t, 0.06, 'square', 900, 500, 0.05);
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
      case 'grunt':
        tone(t, 0.25, 'sawtooth', 110, 80, 0.07, 0.02);
        noise(t, 0.15, 'lowpass', 500, 1, 0.08);
        break;
      case 'squeak':
        tone(t, 0.12, 'square', 900, 1300, 0.04);
        tone(t + 0.12, 0.1, 'square', 1100, 800, 0.04);
        break;
      case 'baa':
        tone(t, 0.35, 'sawtooth', 330, 300, 0.05, 0.03);
        break;
      case 'door':
        if (opt.open) tone(t, 0.18, 'sawtooth', 190, 120, 0.05, 0.02);
        noise(t + (opt.open ? 0.1 : 0), 0.08, 'lowpass', 600, 1, 0.25);
        break;
      case 'equip':
        // armure enfilée : cuir étouffé, métal qui cliquette
        if (opt.mat === 'LEATHER') noise(t, 0.12, 'lowpass', 900, 0.8, 0.3);
        else {
          tone(t, 0.08, 'triangle', 1600, 1200, 0.08);
          tone(t + 0.07, 0.1, 'triangle', 2100, 1700, 0.06);
          noise(t, 0.08, 'bandpass', 3000, 3, 0.15);
        }
        break;
      case 'ignite':
        // briquet : raclement et étincelle
        noise(t, 0.12, 'bandpass', 3200, 2, 0.25);
        noise(t + 0.08, 0.3, 'lowpass', 900, 0.8, 0.12);
        break;
      case 'anvil':
        tone(t, 0.5, 'square', 880, 860, 0.06);
        tone(t, 0.6, 'triangle', 1320, 1300, 0.08);
        noise(t, 0.1, 'bandpass', 2500, 3, 0.3);
        break;
      case 'xp':
        // petit tintement d'expérience
        tone(t, 0.12, 'sine', 1400 + Math.random() * 500, 0, 0.06);
        break;
      case 'enchant': {
        // arpège scintillant
        const base = 520 + Math.random() * 80;
        [0, 4, 7, 12, 16, 19].forEach((k, i) => tone(t + i * 0.06, 0.5, 'triangle', base * Math.pow(2, k / 12), 0, 0.07));
        noise(t, 0.6, 'highpass', 5000, 0.5, 0.05);
        break;
      }
      case 'golem':
        tone(t, 0.25, 'square', 70, 40, 0.12);
        noise(t, 0.12, 'bandpass', 900, 2, 0.2);
        break;
      case 'hmm': {
        // « hmm » de villageois (deux notes nasales)
        const f = 150 + Math.random() * 40;
        tone(t, 0.16, 'sawtooth', f, f * 1.12, 0.05, 0.02);
        tone(t + 0.17, 0.2, 'sawtooth', f * 1.1, f * 0.9, 0.05, 0.02);
        break;
      }
      case 'bounce':
        tone(t, 0.2, 'sine', 180, 520, 0.2);
        break;
      case 'rsclick':
        // levier, bouton, plaque : petit clic mécanique
        tone(t, 0.05, 'square', 1500 * pitch, 900 * pitch, 0.08);
        noise(t, 0.04, 'highpass', 2500, 1, 0.1);
        break;
      case 'piston':
        // piston : souffle et choc de bois
        noise(t, opt.out ? 0.18 : 0.14, 'bandpass', opt.out ? 700 : 500, 1.2, 0.3, opt.out ? 1400 : 300);
        tone(t, 0.08, 'triangle', opt.out ? 180 : 140, opt.out ? 120 : 90, 0.15);
        break;
      case 'dispense':
        tone(t, 0.06, 'square', 1200, 1100, 0.06);
        noise(t + 0.02, 0.08, 'bandpass', 1800, 2, 0.1);
        break;
      case 'bow':
        tone(t, 0.18, 'triangle', 420 * pitch, 180 * pitch, 0.12);
        noise(t, 0.15, 'bandpass', 900, 1.5, 0.12, 400);
        break;
      case 'arrowhit':
        noise(t, 0.06, 'bandpass', 2200, 3, 0.18);
        tone(t, 0.05, 'square', 600, 300, 0.05);
        break;
      case 'cart':
        noise(t, 0.3, 'lowpass', 500 * pitch, 0.7, 0.12 * (opt.vol || 1));
        break;
      case 'portal':
        // portail : bourdonnement qui monte en tournoyant
        tone(t, 1.8, 'sine', 70, 240, 0.14, 0.5);
        tone(t, 1.8, 'triangle', 105, 380, 0.05, 0.6);
        noise(t, 1.6, 'bandpass', 500, 3, 0.08, 2200);
        break;
      case 'travel':
        tone(t, 0.9, 'sine', 420, 90, 0.16, 0.02);
        noise(t, 0.8, 'lowpass', 2400, 0.8, 0.12, 200);
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
      case 'note':
        tone(t, 0.6, 'triangle', 185 * Math.pow(2, (opt.note || 0) / 12), 0, 0.2, 0.004);
        tone(t, 0.3, 'sine', 370 * Math.pow(2, (opt.note || 0) / 12), 0, 0.06);
        break;
      case 'fuse':
        noise(t, 1.2, 'highpass', 3500, 0.5, 0.12);
        break;
      case 'explode':
        noise(t, 1.1, 'lowpass', 700, 0.7, 0.9, 80);
        tone(t, 0.6, 'sine', 90, 30, 0.6);
        break;
      // nouvelles créatures
      case 'cluck':
        tone(t, 0.07, 'square', 900 * pitch, 600, 0.06);
        tone(t + 0.1, 0.06, 'square', 1000 * pitch, 700, 0.05);
        break;
      case 'moo':
        tone(t, 0.9, 'sawtooth', 150 * pitch, 110, 0.12, 0.15);
        noise(t, 0.8, 'lowpass', 400, 0.8, 0.05);
        break;
      case 'hiss':
        noise(t, 1.4, 'highpass', 3000, 0.7, 0.22);
        break;
      case 'skitter':
        for (let i = 0; i < 5; i++) noise(t + i * 0.05, 0.03, 'bandpass', 2500 * pitch, 3, 0.1);
        break;
      case 'rattle':
        for (let i = 0; i < 4; i++) noise(t + i * 0.06, 0.04, 'bandpass', 1400 * pitch, 5, 0.14);
        break;
      case 'squish':
        tone(t, 0.18, 'sine', 180 * pitch, 90, 0.2);
        noise(t, 0.12, 'lowpass', 600, 1, 0.1);
        break;
      case 'growl':
        tone(t, 0.6, 'sawtooth', 95 * pitch, 80, 0.08, 0.1);
        noise(t, 0.6, 'lowpass', 300 * pitch, 1, 0.08);
        break;
      case 'thunder':
        // coup de tonnerre : craquement puis grondement qui roule
        noise(t, 0.25 * pitch, 'highpass', 1800, 0.6, 0.5);
        noise(t + 0.05, 2.6, 'lowpass', 420 * pitch, 0.8, 0.8, 50);
        tone(t, 1.8, 'sine', 70 * pitch, 28, 0.45, 0.05);
        break;
    }
  };
})();
