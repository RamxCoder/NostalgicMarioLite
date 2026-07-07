// Premium Web Audio Synthesizer Engine for Retro-Modern Game SFX and BGM
class AudioEngine {
  private ctx: AudioContext | null = null;
  private musicInterval: any = null;
  private isMutedMusic: boolean = false;
  private isMutedSFX: boolean = false;
  private currentTempo: number = 130; // BPM
  private currentStep: number = 0;
  private activeOscillators: { osc: OscillatorNode; gain: GainNode }[] = [];

  constructor() {
    // Lazy initialize to respect browser user interaction policies
  }

  private initContext() {
    if (!this.ctx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        this.ctx = new AudioCtxClass();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setMute(type: 'music' | 'sfx', mute: boolean) {
    if (type === 'music') {
      this.isMutedMusic = mute;
      if (mute) {
        this.stopMusic();
      } else {
        this.startMusic();
      }
    } else {
      this.isMutedSFX = mute;
    }
  }

  public toggleMute(type: 'music' | 'sfx'): boolean {
    const val = type === 'music' ? !this.isMutedMusic : !this.isMutedSFX;
    this.setMute(type, val);
    return val;
  }

  public getMuteState() {
    return { music: this.isMutedMusic, sfx: this.isMutedSFX };
  }

  // --- SOUND EFFECTS (SFX) ---
  public playJump() {
    if (this.isMutedSFX) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    // Triangle wave for a smooth retro jump sound
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, now);
    // Sweeps up rapidly
    osc.frequency.exponentialRampToValueAtTime(650, now + 0.18);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.18);

    osc.start(now);
    osc.stop(now + 0.19);
  }

  public playCoin() {
    if (this.isMutedSFX) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    // Sine or square wave for bright chime
    osc.type = 'sine';
    // Classic double-ding chime
    osc.frequency.setValueAtTime(987.77, now); // B5
    osc.frequency.setValueAtTime(1318.51, now + 0.08); // E6

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.setValueAtTime(0.12, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

    osc.start(now);
    osc.stop(now + 0.36);
  }

  public playStarCoin() {
    if (this.isMutedSFX) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    // High premium arpeggio for special Star Coins
    const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51]; // C5 E5 G5 C6 E6
    notes.forEach((freq, i) => {
      if (!this.ctx) return;
      const t = now + i * 0.05;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.26);
    });
  }

  public playStomp() {
    if (this.isMutedSFX) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.linearRampToValueAtTime(40, now + 0.15);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.15);

    // Simple noise-like punch with filter
    if ((this.ctx as any).createBiquadFilter) {
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(300, now);
      osc.disconnect(gain);
      osc.connect(filter);
      filter.connect(gain);
    }

    osc.start(now);
    osc.stop(now + 0.16);
  }

  public playDamage() {
    if (this.isMutedSFX) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(400, now);
    // Sad fall and vibrato
    for (let i = 0; i < 15; i++) {
      osc.frequency.setValueAtTime(350 - i * 15 + Math.sin(i) * 20, now + i * 0.02);
    }

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.3);

    osc.start(now);
    osc.stop(now + 0.31);
  }

  public playPowerup() {
    if (this.isMutedSFX) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const notes = [330, 392, 659, 523, 587, 784]; // E4, G4, E5, C5, D5, G5
    notes.forEach((freq, i) => {
      if (!this.ctx) return;
      const t = now + i * 0.07;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.005, t + 0.18);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.2);
    });
  }

  public playCheckpoint() {
    if (this.isMutedSFX) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5 E5 G5 C6
    notes.forEach((freq, i) => {
      if (!this.ctx) return;
      const t = now + i * 0.1;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.45);
    });
  }

  public playBounce() {
    if (this.isMutedSFX) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(900, now + 0.25);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

    osc.start(now);
    osc.stop(now + 0.26);
  }

  public playVictoryFanfare() {
    if (this.isMutedSFX) return;
    this.initContext();
    if (!this.ctx) return;

    this.stopMusic(); // Mute music during victory fanfare

    const now = this.ctx.currentTime;
    // Classic happy victory chime
    // C4 E4 G4 C5 G4 C5
    const mel = [
      { f: 523.25, d: 0.15 }, // C5
      { f: 523.25, d: 0.15 },
      { f: 523.25, d: 0.15 },
      { f: 523.25, d: 0.4 },
      { f: 415.30, d: 0.4 }, // G#4
      { f: 466.16, d: 0.4 }, // A#4
      { f: 523.25, d: 0.8 }, // C5
    ];

    let accum = 0;
    mel.forEach((item) => {
      if (!this.ctx) return;
      const t = now + accum;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(item.f, t);
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.005, t + item.d - 0.02);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + item.d);
      accum += item.d;
    });

    // Automatically resume normal music after melody is complete (approx 3s)
    setTimeout(() => {
      if (!this.isMutedMusic) {
        this.startMusic();
      }
    }, 3000);
  }

  public playGameOver() {
    if (this.isMutedSFX) return;
    this.initContext();
    if (!this.ctx) return;

    this.stopMusic();

    const now = this.ctx.currentTime;
    // Sad melody: C5 -> B4 -> G#4 -> G4
    const mel = [
      { f: 466.16, d: 0.3 }, // Bb4
      { f: 440.00, d: 0.3 }, // A4
      { f: 415.30, d: 0.3 }, // Ab4
      { f: 349.23, d: 0.8 }, // F4
    ];

    let accum = 0;
    mel.forEach((item) => {
      if (!this.ctx) return;
      const t = now + accum;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(item.f, t);
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + item.d - 0.02);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + item.d);
      accum += item.d;
    });
  }

  // --- BACKGROUND MUSIC SYSTEM (BGM) ---
  // Plays a beautiful, looping retro-electronic track synthesized live!
  public startMusic(tempoBpm: number = 135) {
    if (this.isMutedMusic) return;
    this.initContext();
    if (!this.ctx) return;

    this.stopMusic(); // Clear any existing

    this.currentTempo = tempoBpm;
    const stepDuration = 60 / this.currentTempo / 2; // Eighth notes
    this.currentStep = 0;

    // Schedule the looping notes
    const scheduler = () => {
      if (!this.ctx || this.isMutedMusic) return;
      const lookAhead = 0.15; // Schedule 150ms ahead
      const scheduleTime = this.ctx.currentTime + lookAhead;

      // Simple walking bass & retro melody
      // 16-step sequence
      this.playSequencerStep(this.currentStep, scheduleTime);

      this.currentStep = (this.currentStep + 1) % 16;
    };

    // Initial trigger
    scheduler();
    // Looping clock
    this.musicInterval = setInterval(scheduler, stepDuration * 1000);
  }

  public stopMusic() {
    if (this.musicInterval) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
    // Clean up active oscillators
    this.activeOscillators.forEach((item) => {
      try {
        item.osc.stop();
      } catch (e) {}
    });
    this.activeOscillators = [];
  }

  private playSequencerStep(step: number, time: number) {
    if (!this.ctx || this.isMutedMusic) return;

    // Walking Bass Notes (Hz)
    // C-major scale walking: C2, E2, G2, A2, Bb2, A2, G2, E2
    const bassScale = [
      65.41,  // C2
      82.41,  // E2
      98.00,  // G2
      110.00, // A2
      116.54, // Bb2
      110.00, // A2
      98.00,  // G2
      82.41,  // E2
      87.31,  // F2 (change-up)
      110.00, // A2
      130.81, // C3
      146.83, // D3
      146.83, // D3
      130.81, // C3
      110.00, // A2
      87.31,  // F2
    ];

    const bassFreq = bassScale[step];

    // Trigger Bass synth
    const bassOsc = this.ctx.createOscillator();
    const bassGain = this.ctx.createGain();
    bassOsc.type = 'triangle'; // Rich retro bass
    bassOsc.frequency.setValueAtTime(bassFreq, time);
    bassGain.gain.setValueAtTime(0.08, time);
    bassGain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);

    bassOsc.connect(bassGain);
    bassGain.connect(this.ctx.destination);
    bassOsc.start(time);
    bassOsc.stop(time + 0.2);

    // Keep track to stop when muted
    const bassRecord = { osc: bassOsc, gain: bassGain };
    this.activeOscillators.push(bassRecord);
    setTimeout(() => {
      this.activeOscillators = this.activeOscillators.filter(item => item !== bassRecord);
    }, 250);

    // Melody Chords (Pentatonic, happy vibe)
    // Let's program a nice repeating retro melody
    const melodyPattern = [
      523.25, // C5
      0,
      587.33, // D5
      659.25, // E5
      0,
      783.99, // G5
      0,
      880.00, // A5
      987.77, // B5 (step 8)
      0,
      783.99, // G5
      0,
      659.25, // E5
      587.33, // D5
      523.25, // C5
      0
    ];

    const melodyFreq = melodyPattern[step];

    if (melodyFreq > 0 && step % 2 === 0) {
      const melOsc = this.ctx.createOscillator();
      const melGain = this.ctx.createGain();
      melOsc.type = 'sine'; // Pure sweet bell lead
      melOsc.frequency.setValueAtTime(melodyFreq, time);
      melGain.gain.setValueAtTime(0.04, time);
      melGain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);

      melOsc.connect(melGain);
      melGain.connect(this.ctx.destination);
      melOsc.start(time);
      melOsc.stop(time + 0.35);

      const melRecord = { osc: melOsc, gain: melGain };
      this.activeOscillators.push(melRecord);
      setTimeout(() => {
        this.activeOscillators = this.activeOscillators.filter(item => item !== melRecord);
      }, 400);
    }

    // Light hi-hat drum tick on beats
    if (step % 4 === 2) {
      // Create noise buffer
      const bufferSize = this.ctx.sampleRate * 0.04; // 40ms duration
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noiseNode = this.ctx.createBufferSource();
      noiseNode.buffer = buffer;

      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = 'highpass';
      noiseFilter.frequency.setValueAtTime(7000, time);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.015, time);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.04);

      noiseNode.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);

      noiseNode.start(time);
      noiseNode.stop(time + 0.05);
    }
  }
}

export const audio = new AudioEngine();
