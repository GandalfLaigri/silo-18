// Ambiance sonore de la ruche, entièrement synthétisée (Web Audio), selon le profil de la strate.
export interface AudioProfile {
  hum: number; rumble: number; wind: number; drips: number; sludge: number;
  choir: number; hammer: number; siren: boolean; bells: boolean; gunfire: number;
  music: 'none' | 'saloon' | 'quartet' | 'organ';
  vox: boolean;
  birds: number;
}

export interface AudioFrame {
  altitude: number;
  abyss: number;          // proximité du puits (0..1)
  crowd: number;          // habitants proches
  steam: number;          // distance à la vapeur la plus proche
  forge: number;          // distance à la manufacture (Hive City)
  music: number;          // distance à la source musicale de la strate
  lamp: number;           // distance à la lampe la plus proche
  inElevator: boolean;
  elevatorMoving: boolean;
  steps: number;          // compteur de pas (-1 : ne marche pas)
  surface: 'grate' | 'deck' | 'wet' | 'stone';
  indoor: boolean;
  outdoor: number;        // dehors (terrasse de la Flèche) 0..1
  birds: number;          // près des jardins 0..1
  slams: number[];        // distances des marteaux-pilons qui viennent de frapper
  run: boolean;           // le joueur court
}

const NOTE = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
const QUIET: AudioProfile = { hum: 0, rumble: 0, wind: 0, drips: 0, sludge: 0, choir: 0, hammer: 0, siren: false, bells: false, gunfire: 0, music: 'none', vox: false, birds: 0 };

export class HiveAudio {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private music!: GainNode;
  private world!: BiquadFilterNode;   // filtre « à travers les murs » pour l'extérieur
  private white!: AudioBuffer;
  private brown!: AudioBuffer;
  private reverb!: ConvolverNode;
  private layers: Record<string, { g: GainNode; f?: BiquadFilterNode }> = {};
  private choirOsc: OscillatorNode[] = [];
  private organOsc: OscillatorNode[] = [];
  private choirG!: GainNode;
  private organG!: GainNode;
  private chord = 0;
  private chordAt = 0;
  private lastSteps = 0;
  private volume = 0.8;
  private musicVol = 0.7;
  private profile: AudioProfile = QUIET;
  private at: Record<string, number> = { siren: 40, bell: 20, drip: 0, bloop: 0, gun: 8, bird: 0, beat: 0, hammer: 0 };
  private beat = 0;
  private musicK = 0;
  /** Appelé pour les annonces vox (le texte est dit par la synthèse vocale du navigateur). */
  onVox: ((text: string) => void) | null = null;

  start() {
    if (this.ctx) { void this.ctx.resume(); return; }
    const ctx = new AudioContext();
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 4;
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(comp).connect(ctx.destination);
    this.music = ctx.createGain();
    this.music.gain.value = this.musicVol;
    this.music.connect(this.master);
    this.world = ctx.createBiquadFilter();
    this.world.type = 'lowpass';
    this.world.frequency.value = 18000;
    this.world.connect(this.master);
    this.white = this.noise('white');
    this.brown = this.noise('brown');
    this.reverb = ctx.createConvolver();
    const len = ctx.sampleRate * 5.5;
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6) * (i < 800 ? i / 800 : 1);
    }
    this.reverb.buffer = ir;
    const wet = ctx.createGain();
    wet.gain.value = 0.5;
    this.reverb.connect(wet).connect(this.master);

    this.layer('hum', this.filtered(this.brown, 'lowpass', 110), this.world);
    this.layer('rumble', this.filtered(this.brown, 'lowpass', 75, 0.7), this.world);
    this.layer('wind', this.filtered(this.white, 'bandpass', 420, 0.7), this.world);
    this.layer('updraft', this.filtered(this.brown, 'bandpass', 180, 0.6), this.world);
    this.layer('steam', this.filtered(this.white, 'highpass', 2600), this.master);
    this.layer('crowd', this.murmur(), this.master);
    this.layer('forge', this.filtered(this.brown, 'bandpass', 160, 0.8), this.world);
    this.layer('elev', this.filtered(this.brown, 'lowpass', 260), this.master);
    this.layer('buzz', this.buzz(), this.master);
    this.layer('sludge', this.filtered(this.brown, 'lowpass', 90, 3), this.world);
    this.layer('water', this.filtered(this.white, 'bandpass', 1400, 0.5), this.master);
    for (const [name, rate, depth] of [['wind', 0.06, 220], ['rumble', 0.11, 20], ['forge', 0.5, 60], ['sludge', 0.3, 40]] as const) {
      const lfo = ctx.createOscillator(); lfo.frequency.value = rate;
      const lg = ctx.createGain(); lg.gain.value = depth;
      lfo.connect(lg).connect(this.layers[name].f!.frequency); lfo.start();
    }
    // chœur (voyelle « ah »)
    const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 750; f1.Q.value = 6;
    const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 1150; f2.Q.value = 8;
    const mixG = ctx.createGain(); mixG.gain.value = 0.9;
    this.choirG = ctx.createGain(); this.choirG.gain.value = 0;
    f1.connect(mixG); f2.connect(mixG);
    mixG.connect(this.choirG);
    this.choirG.connect(this.music);
    this.choirG.connect(this.reverb);
    const vib = ctx.createOscillator(); vib.frequency.value = 5.2;
    const vg = ctx.createGain(); vg.gain.value = 4;
    vib.connect(vg); vib.start();
    for (let i = 0; i < 8; i++) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.detune.value = (i % 2 ? 1 : -1) * (6 + i);
      vg.connect(o.detune);
      o.connect(f1); o.connect(f2);
      o.start();
      this.choirOsc.push(o);
    }
    // grandes orgues (tuyaux : carrés et dents de scie, filtre doux)
    const olp = ctx.createBiquadFilter(); olp.type = 'lowpass'; olp.frequency.value = 1600;
    this.organG = ctx.createGain(); this.organG.gain.value = 0;
    olp.connect(this.organG);
    this.organG.connect(this.music);
    this.organG.connect(this.reverb);
    for (let i = 0; i < 8; i++) {
      const o = ctx.createOscillator();
      o.type = i % 2 ? 'square' : 'sawtooth';
      const g = ctx.createGain(); g.gain.value = i < 2 ? 0.5 : 0.18;
      o.connect(g).connect(olp);
      o.start();
      this.organOsc.push(o);
    }
    this.setChord(0, true);
  }

  setProfile(p: AudioProfile) {
    this.profile = p;
  }
  setVolume(v: number) {
    this.volume = v;
    if (this.ctx) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1);
  }
  setMusic(v: number) {
    this.musicVol = v;
    if (this.ctx) this.music.gain.setTargetAtTime(v, this.ctx.currentTime, 0.2);
  }

  // ---------------------------------------------------------------------------
  private noise(kind: 'white' | 'brown') {
    const ctx = this.ctx!;
    const len = ctx.sampleRate * 3;
    const b = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'white') d[i] = w;
      else { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
    }
    return b;
  }
  private filtered(buf: AudioBuffer, type: BiquadFilterType, freq: number, q = 0.7) {
    const ctx = this.ctx!;
    const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.start(0, Math.random() * 2);
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    s.connect(f);
    return f;
  }
  private buzz() {
    const ctx = this.ctx!;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 200; f.Q.value = 2;
    for (const [fr, t] of [[100, 'sawtooth'], [200, 'square']] as const) {
      const o = ctx.createOscillator(); o.type = t; o.frequency.value = fr; o.connect(f); o.start();
    }
    return f;
  }
  private murmur() {
    const ctx = this.ctx!;
    const out = ctx.createGain();
    for (const [fr, rate] of [[420, 2.7], [980, 3.9], [2100, 5.1]]) {
      const f = this.filtered(this.white, 'bandpass', fr, 5);
      const g = ctx.createGain(); g.gain.value = 0.5;
      const lfo = ctx.createOscillator(); lfo.type = 'triangle'; lfo.frequency.value = rate;
      const lg = ctx.createGain(); lg.gain.value = 0.45;
      lfo.connect(lg).connect(g.gain); lfo.start();
      f.connect(g).connect(out);
    }
    return out;
  }
  private layer(name: string, src: AudioNode, dest: AudioNode) {
    const g = this.ctx!.createGain();
    g.gain.value = 0;
    src.connect(g).connect(dest);
    this.layers[name] = { g, f: src instanceof BiquadFilterNode ? src : undefined };
  }
  private set(name: string, v: number, tc = 0.3) {
    const l = this.layers[name];
    if (l) l.g.gain.setTargetAtTime(v, this.ctx!.currentTime, tc);
  }
  private setChord(i: number, now = false) {
    const chords = [[50, 57, 62, 65, 69, 74, 38, 45], [46, 53, 58, 62, 65, 70, 34, 41], [43, 50, 55, 58, 62, 67, 31, 38], [45, 52, 57, 61, 64, 69, 33, 40]];
    const c = chords[i % chords.length];
    const t = this.ctx!.currentTime;
    this.choirOsc.forEach((o, k) => o.frequency.setTargetAtTime(NOTE(c[k]), t, now ? 0.01 : 1.2));
    this.organOsc.forEach((o, k) => o.frequency.setTargetAtTime(NOTE(c[k] - 12 + (k < 2 ? 0 : 12)), t, now ? 0.01 : 0.4));
  }
  private burst(dur: number, gain: number, type: BiquadFilterType, freq: number, q = 1, when = 0, dest: AudioNode = this.master) {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime + when;
    const s = ctx.createBufferSource(); s.buffer = this.white;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f).connect(g).connect(dest);
    s.start(t0, Math.random() * 2); s.stop(t0 + dur + 0.05);
  }
  private tone(freq: number, dur: number, gain: number, type: OscillatorType = 'sine', when = 0, dest: AudioNode = this.master, f1?: number, attack = 0.01) {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime + when;
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(dest);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  private hammer(k: number) {
    const dry = Math.max(0.02, k);
    this.tone(62, 0.9, 0.5 * dry, 'sine', 0, this.master, 38);
    this.burst(0.35, 0.35 * dry, 'lowpass', 500, 0.7);
    this.tone(62, 0.9, 0.3 * Math.max(0.3, k), 'sine', 0, this.reverb, 38);
    this.burst(0.2, 0.2 * Math.max(0.3, k), 'bandpass', 900, 2, 0.02, this.reverb);
  }
  private bell(k: number, n: number) {
    for (let i = 0; i < n; i++) {
      const w = i * 2.4;
      for (const [r, g] of [[1, 0.3], [2.01, 0.12], [2.76, 0.08], [5.4, 0.04]]) {
        this.tone(110 * r, 5, g * (0.15 + 0.5 * k), 'sine', w, this.reverb);
        this.tone(110 * r, 4, g * 0.6 * k, 'sine', w, this.master);
      }
    }
  }
  private siren() {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(180, t0);
    o.frequency.linearRampToValueAtTime(420, t0 + 2.5);
    o.frequency.setValueAtTime(420, t0 + 5);
    o.frequency.linearRampToValueAtTime(160, t0 + 8);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.05, t0 + 1); g.gain.setValueAtTime(0.05, t0 + 7); g.gain.linearRampToValueAtTime(0, t0 + 8.5);
    o.connect(f).connect(g).connect(this.reverb);
    o.start(t0); o.stop(t0 + 9);
  }
  private gunfire() {
    const n = Math.random() < 0.5 ? 1 : 2 + Math.floor(Math.random() * 5);
    const far = 0.3 + Math.random() * 0.7;
    for (let i = 0; i < n; i++) {
      const w = i * (0.09 + Math.random() * 0.12);
      this.burst(0.25, 0.25 * far, 'lowpass', 900 + Math.random() * 600, 0.7, w, this.reverb);
      this.burst(0.06, 0.08 * far, 'bandpass', 2000, 1, w, this.master);
    }
  }
  private drip() {
    const f = 900 + Math.random() * 1400;
    this.tone(f, 0.18, 0.05, 'sine', 0, this.reverb, f * 0.6);
    this.tone(f, 0.08, 0.025, 'sine', 0, this.master, f * 0.7);
  }
  private bloop() {
    const f = 60 + Math.random() * 60;
    this.tone(f, 0.35, 0.18, 'sine', 0, this.world, f * 0.5, 0.05);
    this.burst(0.2, 0.05, 'lowpass', 300, 1);
  }
  private chirp() {
    const f = 2400 + Math.random() * 1800;
    const n = 1 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) this.tone(f * (1 + Math.random() * 0.2), 0.09, 0.03, 'sine', i * 0.12, this.master, f * (1.3 + Math.random() * 0.4));
  }
  /** Musique de taverne : banjo pincé, progression folklorique. */
  private saloonBeat(k: number) {
    const prog = [[57, 61, 64], [62, 66, 69], [64, 68, 71], [57, 61, 64]];
    const bar = Math.floor(this.beat / 4) % prog.length;
    const c = prog[bar];
    const step = this.beat % 4;
    const dest = this.music;
    const g = 0.06 * k;
    if (step === 0 || step === 2) this.tone(NOTE(c[0] - 12), 0.3, g * 1.2, 'triangle', 0, dest);
    this.tone(NOTE(c[(this.beat * 7) % 3] + (Math.random() < 0.3 ? 12 : 0)), 0.22, g, 'sawtooth', 0, dest, undefined, 0.003);
    if (step % 2 === 1) for (const n of c) this.tone(NOTE(n), 0.15, g * 0.4, 'square', 0.01, dest, undefined, 0.003);
  }
  /** Quatuor de la salle de bal : valse en ré. */
  private waltzBeat(k: number) {
    const prog = [[50, 62, 66, 69], [55, 62, 67, 71], [57, 61, 64, 69], [50, 62, 66, 69], [47, 62, 66, 71], [52, 59, 67, 71], [57, 61, 64, 67], [50, 62, 66, 69]];
    const bar = Math.floor(this.beat / 3) % prog.length;
    const c = prog[bar];
    const step = this.beat % 3;
    const g = 0.05 * k;
    if (step === 0) this.tone(NOTE(c[0] - 12), 1.0, g * 1.4, 'sawtooth', 0, this.music, undefined, 0.05);
    else for (const n of c.slice(1)) this.tone(NOTE(n), 0.45, g * 0.5, 'sawtooth', 0, this.music, undefined, 0.04);
    const mel = c[1 + ((this.beat * 5 + bar) % 3)] + 12;
    this.tone(NOTE(mel), 0.6, g * 0.8, 'triangle', 0, this.music, undefined, 0.08);
    this.tone(NOTE(mel), 0.6, g * 0.3, 'triangle', 0, this.reverb, undefined, 0.08);
  }

  /** Pas : bruits courts et légers, sans basses (le pied ne doit pas « gronder »). */
  step(surface: AudioFrame['surface'], run = false) {
    if (!this.ctx) return;
    const g = (run ? 1 : 0.7) * (0.8 + Math.random() * 0.4);
    const j = 0.85 + Math.random() * 0.3;
    if (surface === 'grate') {
      this.burst(0.05, 0.07 * g, 'bandpass', 3200 * j, 5);
      this.tone(560 * j, 0.1, 0.012 * g, 'triangle');
    } else if (surface === 'wet') {
      this.burst(0.16, 0.08 * g, 'bandpass', 1100 * j, 0.8);
      this.burst(0.1, 0.04 * g, 'highpass', 2500 * j, 0.7, 0.03);
    } else if (surface === 'stone') {
      this.burst(0.04, 0.07 * g, 'bandpass', 2600 * j, 3);
      this.burst(0.04, 0.02 * g, 'bandpass', 2600 * j, 3, 0, this.reverb);
    } else {
      this.burst(0.045, 0.07 * g, 'bandpass', 1900 * j, 2);
      this.burst(0.05, 0.025 * g, 'bandpass', 700 * j, 1.2);
    }
  }
  /** Décontamination du sas (souffle de vapeur). */
  hiss() {
    if (!this.ctx) return;
    this.burst(3.8, 0.22, 'highpass', 1800, 0.6);
    this.burst(3.8, 0.12, 'bandpass', 600, 0.8, 0, this.reverb);
  }
  /** Stérilisation par les flammes. */
  fire() {
    if (!this.ctx) return;
    this.burst(3.0, 0.4, 'lowpass', 700, 0.7);
    this.tone(55, 3.0, 0.15, 'sawtooth', 0, this.reverb, 45);
  }
  /** Coups sur la porte. */
  knock() {
    if (!this.ctx) return;
    for (let i = 0; i < 3; i++) { this.burst(0.12, 0.35, 'lowpass', 400, 1, i * 0.35); this.tone(90, 0.2, 0.2, 'sine', i * 0.35, this.reverb, 60); }
  }
  /** Frottement de la laine sur la lentille. */
  wipe() {
    if (!this.ctx) return;
    for (let i = 0; i < 6; i++) this.burst(0.3, 0.06, 'bandpass', 2400, 1.5, i * 0.55);
  }
  ding() {
    if (!this.ctx) return;
    this.tone(660, 1.4, 0.1, 'sine'); this.tone(1320, 0.9, 0.04, 'sine');
    this.burst(0.25, 0.15, 'bandpass', 300, 1);
  }
  clank() {
    if (!this.ctx) return;
    this.burst(0.3, 0.3, 'bandpass', 700, 3);
    this.tone(140, 0.4, 0.1, 'square', 0, this.master, 90);
  }
  discover() {
    if (!this.ctx) return;
    this.tone(NOTE(62), 1.6, 0.05, 'sine', 0, this.reverb);
    this.tone(NOTE(69), 1.6, 0.05, 'sine', 0.15, this.reverb);
  }
  /** Cri (formants de voix sur une dent de scie glissante). */
  scream(k: number) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    const f0 = 520 + Math.random() * 200;
    o.frequency.setValueAtTime(f0 * 0.8, t0);
    o.frequency.linearRampToValueAtTime(f0 * 1.25, t0 + 0.25);
    o.frequency.exponentialRampToValueAtTime(f0 * 0.7, t0 + 1.3);
    const vib = ctx.createOscillator(); vib.frequency.value = 7;
    const vg = ctx.createGain(); vg.gain.value = 18;
    vib.connect(vg).connect(o.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.18 * k, t0 + 0.08); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.4);
    for (const [f, q] of [[900, 5], [1700, 7], [2600, 9]]) {
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q;
      o.connect(bp).connect(g);
    }
    g.connect(this.master); g.connect(this.reverb);
    o.start(t0); vib.start(t0); o.stop(t0 + 1.5); vib.stop(t0 + 1.5);
  }
  /** Sifflet d'Enforcer (trille). */
  whistle(k: number) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    for (let i = 0; i < 3; i++) {
      const t0 = ctx.currentTime + i * 0.55;
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 2700;
      const lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 22;
      const lg = ctx.createGain(); lg.gain.value = 180;
      lfo.connect(lg).connect(o.frequency);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.06 * k, t0 + 0.03); g.gain.setValueAtTime(0.06 * k, t0 + 0.35); g.gain.linearRampToValueAtTime(0, t0 + 0.42);
      o.connect(g); g.connect(this.master); g.connect(this.reverb);
      o.start(t0); lfo.start(t0); o.stop(t0 + 0.45); lfo.stop(t0 + 0.45);
    }
  }
  /** Coup de feu proche ou lointain. */
  shot(k: number) {
    if (!this.ctx) return;
    this.burst(0.12, 0.35 * k, 'bandpass', 1400, 0.8);
    this.burst(0.3, 0.2 * Math.max(0.2, k), 'lowpass', 700, 0.7, 0, this.reverb);
  }
  /** Rumeur de stupeur de la foule. */
  gasp(k: number) {
    if (!this.ctx) return;
    this.burst(0.7, 0.08 * k, 'bandpass', 700, 1.5);
    this.burst(0.9, 0.05 * k, 'bandpass', 1400, 2, 0.1, this.reverb);
  }
  /** Coupure / retour du courant. */
  power(on: boolean) {
    if (!this.ctx) return;
    this.tone(on ? 40 : 140, 1.4, 0.12, 'sawtooth', 0, this.master, on ? 140 : 35);
    this.burst(0.4, 0.15, 'bandpass', 300, 2);
  }

  /** Carillon d'annonce vox. */
  voxChime() {
    if (!this.ctx) return;
    for (const [n, w] of [[72, 0], [67, 0.35], [64, 0.7]]) { this.tone(NOTE(n), 1.2, 0.07, 'sine', w, this.reverb); this.tone(NOTE(n), 0.8, 0.05, 'triangle', w); }
  }
  /** Bruit du trajet dans l'ascenseur de strate (0 : arrêt). */
  ride(speed: number) {
    if (!this.ctx) return;
    this.set('elev', Math.min(0.6, speed * 0.015), 0.2);
    this.set('wind', Math.min(0.3, speed * 0.006), 0.2);
    this.set('rumble', 0.3 + Math.min(0.3, speed * 0.008), 0.2);
    for (const l of ['hum', 'updraft', 'steam', 'crowd', 'forge', 'buzz', 'sludge', 'water']) this.set(l, 0, 0.2);
    this.choirG.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3);
    this.organG.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3);
    this.world.frequency.setTargetAtTime(18000, this.ctx.currentTime, 0.2);
  }

  update(f: AudioFrame, t: number) {
    if (!this.ctx) return;
    const p = this.profile;
    const ctx = this.ctx;
    const high = Math.min(1, Math.max(0, f.altitude) / 180);
    this.world.frequency.setTargetAtTime(f.indoor ? 700 : 18000, ctx.currentTime, 0.3);
    this.set('hum', p.hum * (0.12 * (1 - 0.5 * high) + 0.03));
    this.set('rumble', p.rumble * (0.16 + f.abyss * 0.2));
    this.set('wind', p.wind * (0.02 + 0.13 * high + 0.05 * f.abyss) + f.outdoor * 0.35);
    this.set('updraft', f.abyss * 0.25 + (f.altitude < -5 && p.hammer > 0 ? 0.25 : 0));
    this.set('steam', 0.35 * Math.max(0, 1 - f.steam / 9));
    this.set('crowd', Math.min(0.3, f.crowd * 0.02) * (f.inElevator ? 0.5 : 1));
    const forgeK = 1 / (1 + (f.forge / 60) ** 2);
    this.set('forge', p.hammer * (0.05 + 0.4 * forgeK));
    this.set('elev', f.elevatorMoving ? 0.35 : 0, 0.15);
    this.set('buzz', f.lamp < 3 ? 0.012 * (1 - f.lamp / 3) : 0);
    this.set('sludge', p.sludge * 0.35);
    this.set('water', p.sludge > 0 && p.birds > 0 ? 0.03 * (1 - f.outdoor) : 0);
    this.musicK = 1 / (1 + (f.music / 35) ** 2);
    const organ = p.music === 'organ' ? this.musicK : 0;
    this.choirG.gain.setTargetAtTime(p.choir * (0.012 + 0.06 * organ), ctx.currentTime, 0.5);
    this.organG.gain.setTargetAtTime(0.05 * organ * organ, ctx.currentTime, 0.5);
    if (t > this.chordAt) { this.chordAt = t + 7; this.setChord(++this.chord); }
    // rythmes : taverne, valse
    if (p.music === 'saloon' || p.music === 'quartet') {
      const bpm = p.music === 'saloon' ? 200 : 150;
      if (t > this.at.beat) {
        this.at.beat = t + 60 / bpm;
        this.beat++;
        if (this.musicK > 0.015) p.music === 'saloon' ? this.saloonBeat(this.musicK) : this.waltzBeat(this.musicK);
      }
    }
    for (const d of f.slams) this.hammer(1 / (1 + (d / 25) ** 2));
    if (p.hammer > 0 && f.slams.length === 0 && t > this.at.hammer) {
      this.at.hammer = t + (Math.floor(t / 20) % 3 === 2 ? 3.6 : 1.8);
      this.hammer(forgeK * 0.5);
    }
    if (p.bells && t > this.at.bell) { this.at.bell = t + 70 + Math.random() * 40; this.bell(organ, 3); }
    if (p.siren && t > this.at.siren) { this.at.siren = t + 90 + Math.random() * 60; this.siren(); }
    if (p.drips > 0 && t > this.at.drip) { this.at.drip = t + (0.3 + Math.random() * 1.6) / p.drips; this.drip(); }
    if (p.sludge > 0 && t > this.at.bloop) { this.at.bloop = t + (0.4 + Math.random() * 2.5) / p.sludge; if (p.birds === 0) this.bloop(); }
    if (p.gunfire > 0 && t > this.at.gun) { this.at.gun = t + (5 + Math.random() * 16) / p.gunfire; this.gunfire(); }
    if (p.birds > 0 && f.birds > 0.05 && t > this.at.bird) { this.at.bird = t + 0.4 + Math.random() * 2.5; this.chirp(); }
    if (f.steps >= 0 && f.steps !== this.lastSteps) this.step(f.surface, f.run);
    this.lastSteps = f.steps;
  }
}
