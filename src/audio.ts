const MUTED_KEY = 'audio_muted';
const VOLUME_KEY = 'audio_volume';

export class AudioManager {
  private _ctx: AudioContext | null = null;
  private _masterGain: GainNode | null = null;
  private _musicGain: GainNode | null = null;
  private _droneOsc1: OscillatorNode | null = null;
  private _droneOsc2: OscillatorNode | null = null;
  private _padOsc: OscillatorNode | null = null;
  private _padOsc3: OscillatorNode | null = null;
  private _tremoloOsc: OscillatorNode | null = null;
  private _lfoOsc: OscillatorNode | null = null;
  private _lfoGain: GainNode | null = null;
  private _arpInterval: ReturnType<typeof setInterval> | null = null;
  private _arpStopped = false;
  private _musicPlaying = false;
  private _muted: boolean;
  private _volume: number;

  constructor() {
    const storedMuted = localStorage.getItem(MUTED_KEY);
    this._muted = storedMuted === 'true';

    const storedVolume = localStorage.getItem(VOLUME_KEY);
    const parsed = parseFloat(storedVolume ?? '');
    this._volume = Number.isNaN(parsed) ? 0.5 : Math.max(0, Math.min(1, parsed));
  }

  get muted(): boolean {
    return this._muted;
  }

  set muted(value: boolean) {
    this._muted = value;
    localStorage.setItem(MUTED_KEY, String(value));
    this._applyGain();
  }

  get volume(): number {
    return this._volume;
  }

  set volume(value: number) {
    this._volume = Math.max(0, Math.min(1, value));
    localStorage.setItem(VOLUME_KEY, String(this._volume));
    this._applyGain();
  }

  playTyping(): void {
    const { ctx, master } = this._ensureCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(master);
    osc.type = 'square';
    osc.frequency.value = 800 + Math.random() * 400;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.045);
    osc.start();
    osc.stop(ctx.currentTime + 0.045);
  }

  playKill(): void {
    const { ctx, master } = this._ensureCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(master);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.18);
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    osc.start();
    osc.stop(ctx.currentTime + 0.18);
  }

  playExplosion(): void {
    const { ctx, master } = this._ensureCtx();
    const bufferSize = Math.ceil(ctx.sampleRate * 0.38);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.6, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.38);
    source.connect(gain);
    gain.connect(master);
    source.start();
    source.stop(ctx.currentTime + 0.38);
  }

  // Total duration: 3 * 0.10 + 0.15 = 0.45 s (≤600 ms AC)
  playGameStart(): void {
    const { ctx, master } = this._ensureCtx();
    const notes = [440, 554, 659, 880];
    for (let i = 0; i < notes.length; i++) {
      const freq = notes[i] as number;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(master);
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.10;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.3, t + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      osc.start(t);
      osc.stop(t + 0.15);
    }
  }

  // Total duration: 3 * 0.15 + 0.30 = 0.75 s (≤800 ms AC)
  playGameOver(): void {
    const { ctx, master } = this._ensureCtx();
    const notes = [440, 370, 311, 220];
    for (let i = 0; i < notes.length; i++) {
      const freq = notes[i] as number;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(master);
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.15;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.35, t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.30);
      osc.start(t);
      osc.stop(t + 0.30);
    }
  }

  // Creates a melodic synth-space soundtrack:
  //   - bass: triangle pulsing on A2 (110 Hz) with a slow rhythm LFO
  //   - pad: soft sine chord layer at A3/E4/A4 for harmonic warmth
  //   - melody: arpeggio over A minor pentatonic (A3-C4-D4-E4-G4) driven by a sequencer
  //   - lfo: 0.5 Hz tremolo on the pad for a breathing texture
  startMusic(): void {
    if (this._musicPlaying) {
      this._stopMusicNodes();
    }

    const { ctx, master } = this._ensureCtx();

    // Fresh gain node for this music session
    const musicGain = ctx.createGain();
    musicGain.gain.value = 0;
    musicGain.connect(master);
    this._musicGain = musicGain;

    // ---- Bass pulse (triangle, A2 = 110 Hz) ----
    this._droneOsc1 = ctx.createOscillator();
    this._droneOsc1.type = 'triangle';
    this._droneOsc1.frequency.value = 110;

    const bassGain = ctx.createGain();
    bassGain.gain.value = 0.28;
    this._droneOsc1.connect(bassGain);
    bassGain.connect(musicGain);

    // Rhythmic LFO on the bass gain (4 beats/s ≈ 120 BPM quarter note)
    this._lfoOsc = ctx.createOscillator();
    this._lfoOsc.type = 'sine';
    this._lfoOsc.frequency.value = 2; // 2 Hz → pulsing feel at 120 BPM

    this._lfoGain = ctx.createGain();
    this._lfoGain.gain.value = 0.18; // depth of the bass pulse
    this._lfoOsc.connect(this._lfoGain);
    this._lfoGain.connect(bassGain.gain);

    // ---- Soft pad chord (sine, A3/E4/A4) ----
    this._droneOsc2 = ctx.createOscillator();
    this._droneOsc2.type = 'sine';
    this._droneOsc2.frequency.value = 220; // A3

    this._padOsc = ctx.createOscillator();
    this._padOsc.type = 'sine';
    this._padOsc.frequency.value = 330; // E4 (perfect fifth)

    this._padOsc3 = ctx.createOscillator();
    this._padOsc3.type = 'sine';
    this._padOsc3.frequency.value = 440; // A4 (octave)

    const padGain = ctx.createGain();
    padGain.gain.value = 0.07;
    this._droneOsc2.connect(padGain);
    this._padOsc.connect(padGain);
    this._padOsc3.connect(padGain);
    padGain.connect(musicGain);

    // Tremolo LFO on the pad (0.4 Hz breathing)
    this._tremoloOsc = ctx.createOscillator();
    this._tremoloOsc.type = 'sine';
    this._tremoloOsc.frequency.value = 0.4;
    const tremoloGain = ctx.createGain();
    tremoloGain.gain.value = 0.03;
    this._tremoloOsc.connect(tremoloGain);
    tremoloGain.connect(padGain.gain);

    // ---- Melodic arpeggio sequencer (A minor pentatonic) ----
    // Frequencies: A3 C4  D4  E4  G4  A4   C5   E5
    const arpeggioFreqs = [220, 261.63, 293.66, 329.63, 392, 440, 523.25, 659.25];
    // Two-bar pattern (indices into arpeggioFreqs), descends and ascends
    const pattern = [0, 2, 3, 4, 5, 4, 3, 2, 1, 0, 2, 4, 5, 6, 7, 5];
    const stepMs = 250; // 16th note at 120 BPM
    let step = 0;
    this._arpStopped = false;

    const scheduleArp = (): void => {
      if (this._arpStopped) return;
      const freq = arpeggioFreqs[pattern[step % pattern.length] as number] as number;
      const t = ctx.currentTime;

      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      // Filtered square wave for a softer synth lead tone
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1800;
      filter.Q.value = 2;
      osc.connect(filter);
      filter.connect(g);
      g.connect(musicGain);

      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.06, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, t + stepMs / 1000 * 0.85);
      osc.start(t);
      osc.stop(t + stepMs / 1000);

      step++;
    };

    // Fire first note immediately, then schedule recurring ones
    scheduleArp();
    this._arpInterval = setInterval(() => {
      if (this._arpStopped) {
        if (this._arpInterval !== null) clearInterval(this._arpInterval);
        return;
      }
      scheduleArp();
    }, stepMs);

    // Start continuous oscillators
    this._droneOsc1.start();
    this._droneOsc2.start();
    this._padOsc.start();
    this._lfoOsc.start();
    this._padOsc3.start();
    this._tremoloOsc.start();

    // Fade in over 2 seconds
    const now = ctx.currentTime;
    musicGain.gain.setValueAtTime(0, now);
    musicGain.gain.linearRampToValueAtTime(0.18, now + 2);

    this._musicPlaying = true;
  }

  stopMusic(): void {
    if (!this._musicPlaying) return;
    this._stopMusicNodes();
  }

  // Suspend the AudioContext to freeze music at its current position.
  // resumeMusic() will pick up from the exact same point.
  pauseMusic(): void {
    if (this._ctx?.state === 'running') {
      void this._ctx.suspend();
    }
  }

  // Resume a suspended context, or restart music if it was fully stopped.
  resumeMusic(): void {
    if (this._ctx?.state === 'suspended') {
      void this._ctx.resume();
    } else if (!this._musicPlaying) {
      this.startMusic();
    }
  }

  // Gracefully fades out and disconnects all music nodes.
  // Nulls class references immediately so startMusic() can begin a new session.
  private _stopMusicNodes(): void {
    // Stop the arpeggio sequencer
    this._arpStopped = true;
    if (this._arpInterval !== null) {
      clearInterval(this._arpInterval);
      this._arpInterval = null;
    }

    const ctx = this._ctx;
    const gain = this._musicGain;
    const oscs: (OscillatorNode | null)[] = [
      this._droneOsc1, this._droneOsc2, this._padOsc, this._padOsc3, this._tremoloOsc, this._lfoOsc,
    ];

    this._musicGain = null;
    this._droneOsc1 = null;
    this._droneOsc2 = null;
    this._padOsc = null;
    this._padOsc3 = null;
    this._tremoloOsc = null;
    this._lfoOsc = null;
    this._lfoGain = null;
    this._musicPlaying = false;

    if (!ctx || !gain) return;

    // Graceful fade-out: tau = 0.4 s → near-silence in ~2 s
    const now = ctx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setTargetAtTime(0, now, 0.4);

    // Stop oscillators and disconnect the gain node after the fade completes
    setTimeout(() => {
      for (const osc of oscs) {
        try { osc?.stop(); } catch { /* already stopped */ }
      }
      gain.disconnect();
    }, 2500);
  }

  private _ensureCtx(): { ctx: AudioContext; master: GainNode } {
    if (!this._ctx) {
      this._ctx = new AudioContext();
      this._masterGain = this._ctx.createGain();
      this._masterGain.connect(this._ctx.destination);
      this._masterGain.gain.value = this._muted ? 0 : this._volume;
    }
    return { ctx: this._ctx, master: this._masterGain as GainNode };
  }

  private _applyGain(): void {
    if (this._masterGain) {
      this._masterGain.gain.value = this._muted ? 0 : this._volume;
    }
  }
}
