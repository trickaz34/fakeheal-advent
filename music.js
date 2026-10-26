// Musique d'ambiance générée en direct (Web Audio), aucun fichier audio.
// Mélodie : « Douce nuit » (Franz Gruber, 1818, domaine public), arrangée façon synthwave chill.
// Une boucle = un passage avec mélodie puis un passage instrumental (~94 s).

window.XmasMusic = (() => {
  "use strict";

  const BPM = 92;
  const BEAT = 60 / BPM;
  const STEP = BEAT / 2;            // grille en croches
  const STEPS_PER_BAR = 6;          // mesure à 3/4
  const BARS = 24;
  const STEPS_PER_PASS = BARS * STEPS_PER_BAR;
  const LOOKAHEAD = 1.5;            // secondes programmées à l'avance (tient si l'onglet passe en arrière-plan)
  let volume = 0.5;
  let ducked = false;
  const DUCK_LEVEL = 0.3;

  // note:durée en temps
  const MELODY =
    "G4:1.5 A4:.5 G4:1 E4:3 G4:1.5 A4:.5 G4:1 E4:3 " +
    "D5:2 D5:1 B4:3 C5:2 C5:1 G4:3 " +
    "A4:2 A4:1 C5:1.5 B4:.5 A4:1 G4:1.5 A4:.5 G4:1 E4:3 " +
    "A4:2 A4:1 C5:1.5 B4:.5 A4:1 G4:1.5 A4:.5 G4:1 E4:3 " +
    "D5:2 D5:1 F5:1.5 D5:.5 B4:1 C5:3 E5:3 " +
    "C5:1.5 G4:.5 E4:1 G4:1.5 F4:.5 D4:1 C4:6";

  const CHORDS = [
    "Cmaj7", "Cmaj7", "Am7", "Am7", "G7", "G7", "Cmaj7", "Cmaj7",
    "Fmaj7", "Fmaj7", "Cmaj7", "Cmaj7", "Fmaj7", "Fmaj7", "Am7", "Am7",
    "G7", "G7", "Cmaj7", "Cmaj7", "C", "G7", "Cmaj7", "Cmaj7",
  ];
  const VOICINGS = {
    Cmaj7: [48, 52, 55, 59],
    Am7:   [45, 48, 52, 55],
    G7:    [43, 47, 50, 53],
    Fmaj7: [41, 45, 48, 52],
    C:     [48, 52, 55, 60],
  };
  const ARP = [0, 1, 2, 3, 2, 1];

  const NOTE_INDEX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const toMidi = (name) => 12 * (Number(name.slice(-1)) + 1) + NOTE_INDEX[name[0]];
  const freq = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

  // Mélodie indexée par croche : { pas: [midi, durée en temps] }
  const melodyAt = {};
  let cursor = 0;
  for (const token of MELODY.split(" ")) {
    const [note, dur] = token.split(":");
    melodyAt[Math.round(cursor * 2)] = [toMidi(note), Number(dur)];
    cursor += Number(dur);
  }

  let ctx = null;
  let master, bellBus, padBus, noiseBuffer;
  let timer = null;
  let step = 0;
  let nextTime = 0;
  let playing = false;

  // ---------- Mise en place du graphe audio ----------

  function makeImpulse(seconds) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const data = buf.getChannelData(c);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    return buf;
  }

  function setup() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3;
    comp.connect(ctx.destination);

    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(comp);

    const reverb = ctx.createConvolver();
    reverb.buffer = makeImpulse(3.5);
    const reverbWet = ctx.createGain();
    reverbWet.gain.value = 0.45;
    reverb.connect(reverbWet).connect(master);

    // écho rythmé sur les cloches
    const delay = ctx.createDelay(2);
    delay.delayTime.value = BEAT * 0.75;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.3;
    const delayTone = ctx.createBiquadFilter();
    delayTone.type = "lowpass";
    delayTone.frequency.value = 2800;
    const delayWet = ctx.createGain();
    delayWet.gain.value = 0.22;
    delay.connect(delayTone).connect(feedback).connect(delay);
    delayTone.connect(delayWet).connect(master);

    bellBus = ctx.createGain();
    bellBus.connect(master);
    bellBus.connect(reverb);
    bellBus.connect(delay);

    padBus = ctx.createGain();
    padBus.connect(master);
    padBus.connect(reverb);

    noiseBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.25), ctx.sampleRate);
    const nd = noiseBuffer.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  }

  // ---------- Instruments ----------

  function envelope(gain, t, peak, attack, end) {
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
  }

  // Cloche / célesta : fondamentale + partiel inharmonique qui s'éteint vite.
  function bell(midi, t, beats, vol) {
    const f = freq(midi);
    const end = t + Math.max(beats * BEAT, 0.9) + 1.2;

    const o1 = ctx.createOscillator();
    o1.type = "sine";
    o1.frequency.value = f;
    const g1 = ctx.createGain();
    envelope(g1, t, vol, 0.008, end);
    o1.connect(g1).connect(bellBus);

    const o2 = ctx.createOscillator();
    o2.type = "sine";
    o2.frequency.value = f * 2.76;
    const g2 = ctx.createGain();
    envelope(g2, t, vol * 0.3, 0.004, t + 0.5);
    o2.connect(g2).connect(bellBus);

    o1.start(t); o1.stop(end);
    o2.start(t); o2.stop(t + 0.55);
  }

  // Nappe : deux dents de scie légèrement désaccordées par note, filtrées.
  function pad(notes, t, dur) {
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(500, t);
    filter.frequency.linearRampToValueAtTime(1100, t + dur * 0.6);
    filter.Q.value = 0.7;
    const g = ctx.createGain();
    const end = t + dur + 1.4;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.7);
    g.gain.setValueAtTime(0.05, t + dur);
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    filter.connect(g).connect(padBus);

    for (const n of notes) {
      for (const detune of [-8, 8]) {
        const o = ctx.createOscillator();
        o.type = "sawtooth";
        o.frequency.value = freq(n);
        o.detune.value = detune;
        o.connect(filter);
        o.start(t);
        o.stop(end);
      }
    }
  }

  function bass(midi, t, dur) {
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.value = freq(midi);
    const g = ctx.createGain();
    const end = t + dur;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.22, t + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(end);
  }

  // Grelots : bruit filtré très court.
  function sleigh(t, vol) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 7000;
    const g = ctx.createGain();
    envelope(g, t, vol, 0.004, t + 0.14);
    src.connect(hp).connect(g).connect(master);
    src.start(t);
    src.stop(t + 0.16);
  }

  // ---------- Séquenceur ----------

  function scheduleStep(i, t) {
    const pass = Math.floor(i / STEPS_PER_PASS) % 2;   // 0 = avec mélodie, 1 = instrumental
    const s = i % STEPS_PER_PASS;
    const bar = Math.floor(s / STEPS_PER_BAR);
    const inBar = s % STEPS_PER_BAR;
    const notes = VOICINGS[CHORDS[bar]];

    if (inBar === 0) {
      pad(notes, t, BEAT * 3);
      bass(notes[0] - 12, t, BEAT * 2.6);
    }

    bell(notes[ARP[inBar]] + 24, t, 0.5, pass === 0 ? 0.028 : 0.045);
    sleigh(t, inBar === 0 ? 0.05 : inBar % 2 === 0 ? 0.03 : 0.015);

    const m = melodyAt[s];
    if (m) {
      if (pass === 0) {
        bell(m[0], t, m[1], 0.14);
        bell(m[0] + 12, t, m[1], 0.035);
      } else if (inBar === 0) {
        // passage instrumental : quelques notes de la mélodie, très haut et discrètes
        bell(m[0] + 12, t, m[1], 0.04);
      }
    }
  }

  function scheduler() {
    while (nextTime < ctx.currentTime + LOOKAHEAD) {
      scheduleStep(step, nextTime);
      nextTime += STEP;
      step++;
    }
  }

  // ---------- API ----------

  async function start() {
    if (playing) return true;
    if (!ctx) setup();
    try { await ctx.resume(); } catch { /* bloqué par le navigateur */ }
    if (ctx.state !== "running") return false;   // il faudra un clic de l'utilisateur

    playing = true;
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(volume * (ducked ? DUCK_LEVEL : 1), now + 2.5);
    nextTime = Math.max(nextTime, now + 0.1);
    scheduler();
    timer = setInterval(scheduler, 200);
    return true;
  }

  function stop() {
    if (!playing) return;
    playing = false;
    clearInterval(timer);
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(0, now + 0.8);
    // Après le fondu, on jette le contexte (et les notes déjà programmées) ;
    // la reprise repart au début de la mesure suivante.
    setTimeout(() => {
      if (playing || !ctx) return;
      ctx.close();
      ctx = null;
      nextTime = 0;
      step = Math.ceil(step / STEPS_PER_BAR) * STEPS_PER_BAR;
    }, 1000);
  }

  const effective = () => volume * (ducked ? DUCK_LEVEL : 1);

  function glideTo(target, timeConstant) {
    if (!ctx || !playing) return;
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.setTargetAtTime(target, now, timeConstant);
  }

  // v entre 0 et 1 ; appliqué en douceur si la musique joue.
  function setVolume(v) {
    volume = Math.min(1, Math.max(0, v));
    glideTo(effective(), 0.05);
  }

  // Baisse la musique pendant l'ouverture d'une case pour laisser la place aux effets.
  function duck(on) {
    ducked = on;
    glideTo(effective(), on ? 0.15 : 0.6);
  }

  return { start, stop, setVolume, duck, isPlaying: () => playing };
})();
