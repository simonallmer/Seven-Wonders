// Sound — synthesised with the Web Audio API, so there are no audio files to ship.
let ctx = null, master = null, sfxBus = null, ambBus = null, reverb = null, noiseBuf = null;
let muted = localStorage.getItem('sw.muted') === '1';
const amb = {};

function impulse(seconds, decay) {
    const len = ctx.sampleRate * seconds;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
}

export function initAudio() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.9;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp); comp.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.connect(master);
    ambBus = ctx.createGain(); ambBus.gain.value = 0.9; ambBus.connect(master);
    reverb = ctx.createConvolver(); reverb.buffer = impulse(3.2, 2.6);
    const wet = ctx.createGain(); wet.gain.value = 0.32;
    reverb.connect(wet); wet.connect(master);
    sfxBus.connect(reverb);

    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = (last + 0.04 * w) / 1.04; d[i] = w * 0.35 + last * 6; }

    // ambience beds: looping filtered noise, levels are steered by setAmbience()
    const bed = (type, freq, q) => {
        const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
        src.playbackRate.value = 0.6 + Math.random() * 0.3;
        const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
        const g = ctx.createGain(); g.gain.value = 0;
        src.connect(f); f.connect(g); g.connect(ambBus); src.start();
        return { f, g };
    };
    amb.hall = bed('lowpass', 420, 0.3);     // the big glass room
    amb.wind = bed('bandpass', 520, 0.9);    // desert wind
    amb.storm = bed('bandpass', 950, 1.6);   // sandstorm hiss
    amb.water = bed('bandpass', 2300, 0.5);  // falling water in the gardens
    // slow breathing of the wind
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.11;
    const lg = ctx.createGain(); lg.gain.value = 180;
    lfo.connect(lg); lg.connect(amb.wind.f.frequency); lfo.start();
    // a quiet pad in the hall: two detuned fifths
    amb.pad = ctx.createGain(); amb.pad.gain.value = 0;
    const pf = ctx.createBiquadFilter(); pf.type = 'lowpass'; pf.frequency.value = 700;
    for (const f of [110, 164.8, 220.6, 329.2]) {
        const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f; o.detune.value = Math.random() * 14 - 7;
        o.connect(pf); o.start();
    }
    pf.connect(amb.pad); amb.pad.connect(reverb);
}

const now = () => ctx.currentTime;
const ramp = (param, v, t = 1.5) => { param.cancelScheduledValues(now()); param.setTargetAtTime(v, now(), t / 3); };

// scene: 0 = exhibition hall, 1 = inside a wonder (fractions cross-fade); storm 0..1; kind: the wonder's own air
export function setAmbience(scene, storm = 0, kind = 'desert') {
    if (!ctx) return;
    const garden = kind === 'garden', coast = kind === 'coast';
    ramp(amb.hall.g.gain, 0.05 * (1 - scene), 0.6);
    ramp(amb.pad.gain, 0.022 * (1 - scene), 0.8);
    ramp(amb.wind.g.gain, scene * (garden ? 0.016 : coast || kind === 'grove' ? 0.03 : 0.05 + storm * 0.14), 0.6);
    ramp(amb.storm.g.gain, scene * storm * 0.12, 0.8);
    ramp(amb.water.g.gain, garden ? scene * 0.03 : 0, 0.6);
    ramp(amb.hall.g.gain, 0.05 * (1 - scene) + (coast ? scene * 0.03 : 0), 0.6); // far surf
}

export function setMuted(m) {
    muted = m; localStorage.setItem('sw.muted', m ? '1' : '0');
    if (master) ramp(master.gain, m ? 0 : 0.9, 0.2);
}
export const isMuted = () => muted;

function env(g, t, a, peak, d) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}

function tone(freq, { t = 0, type = 'sine', a = 0.004, d = 0.25, vol = 0.2, slide = 0 } = {}) {
    const o = ctx.createOscillator(), g = ctx.createGain(), T = now() + t;
    o.type = type; o.frequency.setValueAtTime(freq, T);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), T + a + d);
    env(g, T, a, vol, d);
    o.connect(g); g.connect(sfxBus); o.start(T); o.stop(T + a + d + 0.05);
}

function noise({ t = 0, a = 0.005, d = 0.2, vol = 0.2, type = 'bandpass', freq = 1000, q = 1, sweep = 0 } = {}) {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), T = now() + t;
    s.buffer = noiseBuf; s.loop = true;
    f.type = type; f.frequency.setValueAtTime(freq, T); f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(30, freq * sweep), T + a + d);
    env(g, T, a, vol, d);
    s.connect(f); f.connect(g); g.connect(sfxBus);
    s.start(T, Math.random() * 3); s.stop(T + a + d + 0.05);
}

// stone set down on stone
function clack(t = 0, vol = 1) {
    tone(190 + Math.random() * 30, { t, d: 0.09, vol: 0.32 * vol, slide: 0.55 });
    tone(1250 + Math.random() * 200, { t, type: 'triangle', d: 0.035, vol: 0.09 * vol });
    noise({ t, d: 0.05, vol: 0.16 * vol, freq: 2600, q: 0.7 });
}

const SFX = {
    tick() { tone(1500, { d: 0.03, vol: 0.05, type: 'triangle' }); noise({ d: 0.02, vol: 0.04, freq: 4000 }); },
    browse() { noise({ a: 0.05, d: 0.28, vol: 0.07, freq: 500, sweep: 2.4, q: 0.8 }); tone(392, { t: 0.12, d: 0.5, vol: 0.035 }); },
    select() { tone(330, { d: 0.12, vol: 0.09, type: 'triangle' }); tone(495, { t: 0.03, d: 0.18, vol: 0.06 }); },
    deny() { tone(150, { d: 0.14, vol: 0.12, type: 'triangle', slide: 0.8 }); },
    paper() { noise({ a: 0.02, d: 0.22, vol: 0.12, type: 'highpass', freq: 2200, sweep: 1.8 }); noise({ t: 0.14, a: 0.02, d: 0.16, vol: 0.08, type: 'highpass', freq: 3000 }); },
    enter() { // the dive into a wonder
        noise({ a: 0.9, d: 1.6, vol: 0.2, freq: 240, sweep: 5, q: 0.7 });
        tone(55, { a: 0.6, d: 2.2, vol: 0.22 });
        [220, 277.2, 329.6, 440].forEach((f, i) => tone(f, { t: 0.5 + i * 0.16, a: 0.3, d: 1.8, vol: 0.05 }));
    },
    leave() { noise({ a: 0.4, d: 1.2, vol: 0.14, freq: 1200, sweep: 0.25, q: 0.7 }); tone(110, { a: 0.2, d: 1.2, vol: 0.1 }); },
    slide(len = 1) {
        const d = 0.12 + len * 0.07;
        noise({ a: 0.03, d, vol: 0.13, freq: 900, sweep: 0.7, q: 1.4 });
        noise({ a: 0.03, d, vol: 0.08, type: 'lowpass', freq: 260 });
        clack(d + 0.02, 0.8);
    },
    jump() { noise({ a: 0.02, d: 0.1, vol: 0.06, freq: 700 }); clack(0.26, 1); },
    push() { noise({ a: 0.04, d: 0.3, vol: 0.16, type: 'lowpass', freq: 380 }); clack(0.02, 0.9); clack(0.34, 0.7); },
    smash() {
        clack(0, 1.4);
        noise({ d: 0.5, vol: 0.4, freq: 1800, sweep: 0.2, q: 0.5 });
        tone(70, { d: 0.55, vol: 0.45, slide: 0.5 });
        for (let i = 0; i < 7; i++) tone(1800 + Math.random() * 2600, { t: 0.05 + Math.random() * 0.4, type: 'triangle', d: 0.03, vol: 0.05 });
    },
    fall() {
        tone(520, { d: 0.5, vol: 0.08, slide: 0.3, type: 'triangle' });
        noise({ t: 0.5, a: 0.01, d: 0.5, vol: 0.3, type: 'lowpass', freq: 500, sweep: 0.3 });
        tone(60, { t: 0.5, d: 0.4, vol: 0.4, slide: 0.6 });
    },
    osiris() {
        tone(49, { a: 0.05, d: 2.4, vol: 0.4 });
        [146.8, 174.6, 220, 277.2].forEach((f, i) => tone(f, { t: i * 0.05, a: 0.25, d: 2.0, vol: 0.07, type: 'sawtooth' }));
        noise({ a: 0.5, d: 1.6, vol: 0.12, type: 'highpass', freq: 3500, sweep: 2 });
        for (let i = 0; i < 9; i++) tone(880 * Math.pow(2, Math.floor(Math.random() * 12) / 12), { t: 0.5 + i * 0.09, d: 0.5, vol: 0.03 });
    },
    victory() {
        tone(73.4, { a: 0.1, d: 3.5, vol: 0.3 });
        [293.7, 370, 440, 587.3, 740, 880, 1174.7].forEach((f, i) => {
            tone(f, { t: i * 0.13, d: 1.6, vol: 0.09, type: 'triangle' });
            tone(f * 2, { t: i * 0.13, d: 0.8, vol: 0.025 });
        });
    },
    defeat() { [220, 207.6, 174.6, 146.8].forEach((f, i) => tone(f, { t: i * 0.3, a: 0.05, d: 1.4, vol: 0.09, type: 'triangle' })); tone(55, { a: 0.2, d: 2.6, vol: 0.25 }); },
    falcon() { // far away, high above
        for (let i = 0; i < 3; i++) tone(2400, { t: i * 0.22, a: 0.03, d: 0.16, vol: 0.012, slide: 0.72, type: 'triangle' });
    },
    // ---- Gardens
    pickup() { noise({ a: 0.02, d: 0.12, vol: 0.07, freq: 1400, sweep: 1.6, q: 1.2 }); tone(420, { d: 0.08, vol: 0.04, type: 'triangle', slide: 1.3 }); },
    place(n = 1) { clack(0, 0.75); if (n > 1) clack(0.05, 0.5); },
    rustle(n = 1) { // stones set down on the lawn
        noise({ a: 0.01, d: 0.16, vol: 0.09, type: 'highpass', freq: 2600 });
        for (let i = 0; i < Math.min(n, 5); i++) tone(150 + Math.random() * 40, { t: i * 0.045, d: 0.07, vol: 0.14, slide: 0.6 });
    },
    capture() { tone(98, { d: 0.35, vol: 0.2, slide: 0.7 }); tone(1174.7, { t: 0.02, d: 0.5, vol: 0.035, type: 'triangle' }); },
    lift() { [196, 246.9, 293.7].forEach((f, i) => tone(f, { t: i * 0.09, d: 0.4, vol: 0.06, type: 'triangle' })); noise({ a: 0.05, d: 0.3, vol: 0.06, freq: 900, sweep: 2 }); },
    stairs(n = 1) { // a harp running up the steps
        [293.7, 329.6, 370, 440, 493.9, 587.3].forEach((f, i) => { tone(f, { t: 0.3 + i * 0.095, d: 0.7, vol: 0.06, type: 'triangle' }); tone(f * 2, { t: 0.3 + i * 0.095, d: 0.3, vol: 0.015 }); });
        for (let i = 0; i < Math.min(n, 5); i++) clack(1.15 + i * 0.16, 0.5);
    },
    songbird() {
        const base = 2600 + Math.random() * 1400, n = 2 + Math.floor(Math.random() * 4);
        for (let i = 0; i < n; i++) tone(base * (1 + (i % 2) * 0.18), { t: i * 0.11, a: 0.01, d: 0.07, vol: 0.011, slide: i % 2 ? 0.82 : 1.25 });
    },
    // ---- Skyscraper
    switch() { tone(1900, { d: 0.02, vol: 0.08, type: 'square' }); noise({ d: 0.02, vol: 0.1, freq: 3000 }); tone(120, { t: 0.02, a: 0.05, d: 0.5, vol: 0.05, type: 'sawtooth' }); tone(660, { t: 0.05, d: 0.5, vol: 0.03 }); },
    surge() { tone(90, { a: 0.1, d: 0.9, vol: 0.12, slide: 2.2, type: 'sawtooth' }); for (let i = 0; i < 6; i++) tone(1900, { t: 0.1 + i * 0.09, d: 0.02, vol: 0.05, type: 'square' }); },
    // ---- Great Wall
    bow() { tone(180, { a: 0.004, d: 0.22, vol: 0.14, slide: 0.5, type: 'triangle' }); noise({ a: 0.01, d: 0.35, vol: 0.09, type: 'highpass', freq: 2600, sweep: 0.5 }); },
    clang() { [1244, 1865, 2637].forEach((f, i) => tone(f, { d: 0.5 - i * 0.1, vol: 0.05, type: 'triangle' })); noise({ d: 0.05, vol: 0.12, freq: 3200, q: 0.8 }); },
    whoosh() { noise({ a: 0.08, d: 0.4, vol: 0.16, type: 'bandpass', freq: 600, sweep: 3.2, q: 0.9 }); },
    // ---- Pharos
    beam() { tone(880, { a: 0.02, d: 0.35, vol: 0.05, slide: 1.5 }); tone(1320, { t: 0.03, a: 0.02, d: 0.3, vol: 0.025, type: 'triangle' }); noise({ t: 0.16, a: 0.03, d: 0.2, vol: 0.07, freq: 900, sweep: 0.7, q: 1.4 }); clack(0.42, 0.7); },
    kindle() { noise({ a: 0.05, d: 0.7, vol: 0.12, type: 'bandpass', freq: 700, sweep: 2.6, q: 0.7 }); [392, 523.3, 659.3].forEach((f, i) => tone(f, { t: 0.1 + i * 0.07, d: 0.7, vol: 0.04, type: 'triangle' })); },
    // ---- Colossus
    tilt() { // timber and bronze taking the weight
        noise({ a: 0.15, d: 0.7, vol: 0.1, type: 'lowpass', freq: 240, sweep: 1.8 });
        tone(92, { a: 0.1, d: 0.8, vol: 0.12, slide: 0.8, type: 'triangle' });
        tone(310, { t: 0.1, a: 0.05, d: 0.25, vol: 0.02, slide: 1.3, type: 'sawtooth' });
    },
    hades() { tone(55, { a: 0.04, d: 1.6, vol: 0.3, slide: 0.7 }); [185, 196].forEach((f) => tone(f, { a: 0.2, d: 1.3, vol: 0.04, type: 'sawtooth' })); noise({ a: 0.2, d: 0.9, vol: 0.07, type: 'lowpass', freq: 400 }); },
    // ---- Mausoleum
    collapse() { // a slab gives way
        noise({ a: 0.02, d: 0.9, vol: 0.2, type: 'lowpass', freq: 320, sweep: 0.35 });
        tone(58, { d: 0.8, vol: 0.24, slide: 0.55 });
        for (let i = 0; i < 5; i++) clack(0.1 + i * 0.11 + Math.random() * 0.05, 0.35);
    },
    gull() { for (let i = 0; i < 3; i++) tone(1500, { t: i * 0.3, a: 0.04, d: 0.2, vol: 0.011, slide: 0.7, type: 'triangle' }); },
    // ---- Statue
    roll() { clack(0.2, 0.7); noise({ a: 0.02, d: 0.16, vol: 0.05, type: 'lowpass', freq: 500 }); },
    strike() { // a far crack of thunder, kept small
        noise({ a: 0.004, d: 0.12, vol: 0.14, type: 'highpass', freq: 2400 });
        noise({ t: 0.04, a: 0.03, d: 0.9, vol: 0.16, type: 'lowpass', freq: 260, sweep: 0.4 });
        tone(62, { t: 0.03, d: 0.7, vol: 0.2, slide: 0.6 });
    },
    charge() { // the die turned over by the god: a crackle, a rising shimmer
        for (let i = 0; i < 6; i++) noise({ t: i * 0.045, a: 0.003, d: 0.03, vol: 0.05, type: 'highpass', freq: 3800 });
        tone(520, { a: 0.02, d: 0.45, vol: 0.05, slide: 2.2, type: 'triangle' }); tone(1560, { t: 0.3, d: 0.4, vol: 0.02 });
        clack(0.5, 0.6);
    },
    diminish() { [392, 349.2, 311.1].forEach((f, i) => tone(f, { t: i * 0.1, d: 0.35, vol: 0.06, type: 'triangle' })); },
    // ---- Temple
    take() { tone(880, { d: 0.5, vol: 0.04, type: 'triangle' }); tone(1318.5, { t: 0.05, d: 0.6, vol: 0.025 }); noise({ a: 0.02, d: 0.25, vol: 0.06, type: 'highpass', freq: 3000 }); },
    cicada() { for (let i = 0; i < 14; i++) noise({ t: i * 0.055, a: 0.004, d: 0.03, vol: 0.012, freq: 5200, q: 6 }); },
    cricket() { for (let i = 0; i < 4; i++) tone(4300, { t: i * 0.07, a: 0.005, d: 0.035, vol: 0.006, type: 'triangle' }); },
    gust() { noise({ a: 1.2, d: 2.4, vol: 0.12, freq: 420, sweep: 2.2, q: 1.2 }); },
};

export function sfx(name, ...args) {
    if (!ctx || muted || ctx.state !== 'running') return;
    try { SFX[name] && SFX[name](...args); } catch (e) { /* audio must never break the game */ }
}
