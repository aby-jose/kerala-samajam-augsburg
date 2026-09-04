/**
 * Cinematic Web Audio synthesizer for the Stage Launch Ceremony.
 *
 * Uses multi-harmonic acoustic synthesis (deep orchestral bass drum,
 * resonant temple chime, and warm brass crescendo) rather than synthetic beeps.
 */

class LaunchAudioController {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isMuted: boolean = false;

  /**
   * One context for the life of the page.
   *
   * This used to construct a fresh `AudioContext` whenever it found the
   * existing one suspended. Browsers cap live contexts at around six, so a
   * handful of rehearsals would exhaust the budget and the real ceremony would
   * play to a silent hall. Resume the one we have; never make another.
   *
   * Returns null off the browser (tests, SSR) rather than throwing — a stage
   * that white-screens is worse than a stage that is quiet.
   */
  private getContext(): AudioContext | null {
    if (typeof window === "undefined") return null;

    try {
      if (!this.ctx) {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        if (!AudioCtx) return null;
        this.ctx = new AudioCtx();
      }

      if (this.ctx.state === "suspended") {
        void this.ctx.resume();
      }

      return this.ctx;
    } catch {
      return null;
    }
  }

  /**
   * The one node every cue is routed through.
   *
   * Nothing connects to `ctx.destination` directly any more. A single master
   * gain is what makes `stopAll()` possible: the fanfare alone runs about 5.2
   * seconds, and an operator rehearsing thirty times otherwise stacks thirty
   * overlapping fanfares with no way to silence them.
   *
   * Returns null rather than throwing if the node cannot be made — same
   * contract as `getContext()`.
   */
  private masterFor(ctx: AudioContext): GainNode | null {
    try {
      if (!this.masterGain) {
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(1, ctx.currentTime);
        gain.connect(ctx.destination);
        this.masterGain = gain;
      }
      return this.masterGain;
    } catch {
      return null;
    }
  }

  /**
   * Cut everything that is currently sounding.
   *
   * Silences the master gain and drops it. Web Audio gives no way to cancel
   * already-scheduled sources, so the next cue builds a fresh master and the
   * old one — with every in-flight oscillator still hanging off it — is muted
   * and disconnected. Deliberately does NOT call `getContext()`: stopping
   * should never be the thing that creates a context.
   */
  public stopAll(): void {
    const ctx = this.ctx;
    const gain = this.masterGain;
    this.masterGain = null;

    if (!ctx || !gain) return;

    try {
      gain.gain.cancelScheduledValues(ctx.currentTime);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.disconnect();
    } catch {
      // Already disconnected, or a context in a state that refuses. Either way
      // the node is off the graph as far as this controller is concerned.
    }
  }

  /**
   * Called from the operator's first click, and only from there.
   *
   * Browsers refuse to produce sound until the page has had a real user
   * gesture. If the fanfare is the first thing that tries, the ceremony plays
   * in silence and nobody discovers it until the moment has passed. Creating
   * and resuming the context behind an explicit operator action is what makes
   * that failure impossible.
   */
  public unlock(): void {
    this.getContext();
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  public getMuted() {
    return this.isMuted;
  }

  /**
   * One beat of the count-in. Short, dry, and low enough to carry over a room
   * of two hundred people talking.
   */
  public playTick() {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const out = this.masterFor(ctx);
    if (!out) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(660, now);
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.09);

      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

      osc.connect(gain);
      gain.connect(out);

      osc.start(now);
      osc.stop(now + 0.18);
    } catch {
      // A missing cue is survivable; a thrown one is not.
    }
  }

  /**
   * Heavy fabric travelling — filtered noise swept downward over the full
   * parting duration, rather than the short silk snip the ribbon used.
   */
  public playCurtainSweep() {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const out = this.masterFor(ctx);
    if (!out) return;

    try {
      const now = ctx.currentTime;
      const duration = 1.6;

      const bufferSize = Math.floor(ctx.sampleRate * duration);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.Q.setValueAtTime(0.8, now);
      filter.frequency.setValueAtTime(1400, now);
      filter.frequency.exponentialRampToValueAtTime(280, now + duration);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.32, now + 0.25);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(out);

      noise.start(now);
      noise.stop(now + duration);
    } catch {
      // As above.
    }
  }

  /**
   * Resonant acoustic percussion crescendo + majestic orchestral fanfare chords.
   */
  public playLaunchFanfare() {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const out = this.masterFor(ctx);
    if (!out) return;

    try {
      const now = ctx.currentTime;

      // 1. Deep acoustic drum resonance (Chenda / orchestral timpani strike)
      const drumTimes = [0.0, 0.22, 0.42, 0.6, 0.75, 0.88, 1.0, 1.1, 1.2, 1.28, 1.35, 1.42, 1.5];
      drumTimes.forEach((dt, idx) => {
        const t = now + dt;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        const startFreq = 120 + idx * 4;
        osc.frequency.setValueAtTime(startFreq, t);
        osc.frequency.exponentialRampToValueAtTime(38, t + 0.18);

        const vol = 0.2 + (idx / drumTimes.length) * 0.6;
        gain.gain.setValueAtTime(vol, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

        osc.connect(gain);
        gain.connect(out);

        osc.start(t);
        osc.stop(t + 0.22);
      });

      // 2. Warm harmonic pad crescendo (D Major: D, F#, A, D5, F#5)
      const chordNotes = [146.83, 220.00, 293.66, 369.99, 440.00, 587.33];
      const padStart = now + 0.6;

      chordNotes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, padStart);

        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(800, padStart);
        filter.frequency.exponentialRampToValueAtTime(3200, padStart + 1.2);

        gain.gain.setValueAtTime(0.001, padStart);
        gain.gain.linearRampToValueAtTime(0.12 / (1 + idx * 0.1), padStart + 0.5);
        gain.gain.setValueAtTime(0.12 / (1 + idx * 0.1), padStart + 2.5);
        gain.gain.exponentialRampToValueAtTime(0.0001, padStart + 5.0);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(out);

        osc.start(padStart);
        osc.stop(padStart + 5.2);
      });

      // 3. Shimmering acoustic chime / bell harmonics
      const chimes = [
        { t: 0.8, f: 1760.00 },
        { t: 1.1, f: 2217.46 },
        { t: 1.4, f: 2637.02 },
        { t: 1.7, f: 3520.00 },
        { t: 2.1, f: 4434.92 },
      ];

      chimes.forEach(({ t, f }) => {
        const chimeTime = now + t;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(f, chimeTime);

        gain.gain.setValueAtTime(0.15, chimeTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, chimeTime + 1.2);

        osc.connect(gain);
        gain.connect(out);

        osc.start(chimeTime);
        osc.stop(chimeTime + 1.3);
      });
    } catch {
      // Audio context policy
    }
  }

  /**
   * Subtle preview test sound.
   */
  public playTestTone() {
    const ctx = this.getContext();
    if (!ctx) return;
    const out = this.masterFor(ctx);
    if (!out) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.3);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

      osc.connect(gain);
      gain.connect(out);

      osc.start(now);
      osc.stop(now + 0.55);
    } catch {
      // Ignore
    }
  }
}

export const launchAudio = new LaunchAudioController();
