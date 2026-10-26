// Effets sonores de l'ouverture, synthétisés en direct (Web Audio), aucun fichier audio.
// appear  : le cadeau apparaît (whoosh + petit « bloop »)
// jingle  : grelots quand le cadeau gigote
// drumroll: roulement de tambour après le clic sur le cadeau (montée en tension)
// burst   : ouverture (impact + carillon, plus riche selon la rareté)

window.XmasSfx = (() => {
  "use strict";

  let ctx = null;
  let master, reverb, noiseBuffer;
  let volume = 0.5;

  const freq = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

  function ensure() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();

      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      comp.connect(ctx.destination);

      master = ctx.createGain();
      master.gain.value = volume;
      master.connect(comp);

      // réverbe : réponse impulsionnelle générée (bruit qui décroît)
      const len = Math.floor(ctx.sampleRate * 2.5);
      const ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let c = 0; c < 2; c++) {
        const d = ir.getChannelData(c);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
      }
      reverb = ctx.createConvolver();
      reverb.buffer = ir;
      const wet = ctx.createGain();
      wet.gain.value = 0.4;
      reverb.connect(wet).connect(master);

      noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const nd = noiseBuffer.getChannelData(0);
      for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx.currentTime + 0.02;
  }

  function out(node, wet = true) {
    node.connect(master);
    if (wet) node.connect(reverb);
  }

  // Note simple avec enveloppe, glissando optionnel.
  function tone(f, t, dur, { type = "sine", vol = 0.1, attack = 0.005, glideTo = null, wet = true } = {}) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    out(g, wet);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  // Cloche : fondamentale + partiel inharmonique.
  function bell(f, t, vol = 0.1, dur = 1.4) {
    tone(f, t, dur, { vol });
    tone(f * 2.76, t, dur * 0.35, { vol: vol * 0.35 });
  }

  // Bruit filtré dont la fréquence balaie de f0 à f1.
  function noise(t, dur, { type = "bandpass", f0 = 1000, f1 = f0, q = 1, vol = 0.1, attack = 0.01, wet = true } = {}) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(f0, t);
    filter.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(g);
    out(g, wet);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  // ---------- Sons ----------

  function appear() {
    const t = ensure();
    noise(t, 0.4, { f0: 300, f1: 3200, q: 1.2, vol: 0.12, attack: 0.15 });
    tone(280, t + 0.12, 0.22, { vol: 0.16, glideTo: 640, attack: 0.01 });
    bell(freq(91), t + 0.3, 0.05);            // G6
  }

  function jingle() {
    const t = ensure();
    for (let i = 0; i < 4; i++) {
      const ti = t + i * 0.05 + Math.random() * 0.015;
      noise(ti, 0.09, { type: "bandpass", f0: 7000 + Math.random() * 2500, q: 3, vol: 0.06, attack: 0.002, wet: false });
    }
    bell(freq(96 + [0, 4, 7][(Math.random() * 3) | 0]), t + 0.02, 0.018, 0.6);
  }

  // Coup de caisse claire : bruit filtré + petite note grave pour le corps du fût.
  function snare(t, vol) {
    noise(t, 0.08, { type: "bandpass", f0: 2600, q: 0.8, vol, attack: 0.002, wet: false });
    tone(185, t, 0.06, { type: "triangle", vol: vol * 0.45, attack: 0.002, wet: false });
  }

  // Roulement de tambour qui accélère et monte en volume, sur un grondement grave,
  // puis s'arrête net `gap` secondes avant l'ouverture (silence dramatique).
  function drumroll(dur = 2.6, gap = 0.18) {
    const t = ensure();
    const end = t + dur - gap;
    let time = t;
    while (time < end) {
      const p = (time - t) / (end - t);                     // 0 → 1
      snare(time, 0.03 + 0.2 * p * p);
      time += (0.085 - 0.048 * p) * (0.9 + Math.random() * 0.2);
    }

    // grondement de timbale qui enfle
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(52, t);
    o.frequency.linearRampToValueAtTime(64, end);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.28, end - 0.02);
    g.gain.linearRampToValueAtTime(0.0001, end + 0.03);
    o.connect(g);
    out(g, false);
    o.start(t);
    o.stop(end + 0.05);

    // nappe qui monte en dessous, discrète
    const saw = ctx.createOscillator();
    saw.type = "sawtooth";
    saw.frequency.setValueAtTime(90, t);
    saw.frequency.exponentialRampToValueAtTime(360, end);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(250, t);
    lp.frequency.exponentialRampToValueAtTime(2600, end);
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0.0001, t);
    sg.gain.exponentialRampToValueAtTime(0.045, end - 0.02);
    sg.gain.linearRampToValueAtTime(0.0001, end + 0.03);
    saw.connect(lp).connect(sg);
    out(sg);
    saw.start(t);
    saw.stop(end + 0.05);

    // souffle aigu qui monte jusqu'au silence
    noise(t, end - t, { type: "highpass", f0: 800, f1: 7000, vol: 0.08, attack: (end - t) * 0.95 });
  }

  const ARPEGGIO = [84, 88, 91, 96, 100, 103, 108];   // do-mi-sol en montant
  const NOTES_BY_RARITY = { uncommon: 3, rare: 4, epic: 5, legendary: 7 };

  function burst(rarity = "rare") {
    const t = ensure();

    // impact + cymbale crash
    tone(160, t, 0.6, { vol: 0.5, glideTo: 38, attack: 0.003, wet: false });
    noise(t, 0.45, { type: "lowpass", f0: 3500, f1: 400, vol: 0.22, attack: 0.003 });
    noise(t, 1.9, { type: "highpass", f0: 6000, f1: 4500, vol: 0.13, attack: 0.004 });

    // carillon montant
    const n = NOTES_BY_RARITY[rarity] || 4;
    for (let i = 0; i < n; i++) {
      bell(freq(ARPEGGIO[i]), t + 0.08 + i * 0.07, 0.11);
    }

    // épique et légendaire : pluie d'étincelles aiguës
    if (rarity === "epic" || rarity === "legendary") {
      const sparkle = [96, 98, 100, 103, 105, 108, 110];
      for (let i = 0; i < 8; i++) {
        bell(freq(sparkle[(Math.random() * sparkle.length) | 0]), t + 0.5 + i * 0.06 + Math.random() * 0.03, 0.035, 0.8);
      }
    }

    // légendaire : accord de fanfare qui s'ouvre
    if (rarity === "legendary") {
      const end = t + 2.2;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(600, t + 0.3);
      lp.frequency.linearRampToValueAtTime(3500, t + 1.2);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + 0.3);
      g.gain.linearRampToValueAtTime(0.05, t + 0.8);
      g.gain.exponentialRampToValueAtTime(0.0001, end);
      lp.connect(g);
      out(g);
      for (const m of [60, 64, 67, 72, 76]) {
        for (const detune of [-7, 7]) {
          const o = ctx.createOscillator();
          o.type = "sawtooth";
          o.frequency.value = freq(m);
          o.detune.value = detune;
          o.connect(lp);
          o.start(t + 0.3);
          o.stop(end + 0.05);
        }
      }
    }
  }

  function setVolume(v) {
    volume = Math.min(1, Math.max(0, v));
    if (ctx) master.gain.setTargetAtTime(volume, ctx.currentTime, 0.05);
  }

  return { appear, jingle, drumroll, burst, setVolume };
})();
