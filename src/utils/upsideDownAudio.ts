import {
  computeEffectiveAmbientGain,
  getNostalgiaArpPattern,
  getSynthFrequencyForLetter,
  NOSTALGIA_ARP_STEP_MS,
} from './labLogic';

/**
 * Procedural Web Audio engine for STRANGER THINGS AI:
 * 1. Seamless Upside Down ambient soundscape (sub-bass rumbles, bio-electric crackle, distant echoes, 80s analog shimmer)
 * 2. Tactile 1980s Hawkins Laboratory UI sound effects & nostalgic Prophet/Juno-style Cmaj7 arpeggio theme
 */
export class UpsideDownSoundscape {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private uiGain: GainNode | null = null;
  private rumbleFilter: BiquadFilterNode | null = null;
  private isStarted = false;
  private isMuted = false;
  private uiSoundsEnabled = true;
  private nostalgiaSynthEnabled = true;
  private volume = 0.45;
  private dimensionMode: 'hawkins' | 'upside-down' = 'hawkins';
  private distantTimerId: number | null = null;
  private activeNodes: AudioNode[] = [];
  private oscillators: OscillatorNode[] = [];
  private bufferSources: AudioBufferSourceNode[] = [];
  private themeOscillators: OscillatorNode[] = [];
  private themeMasterGain: GainNode | null = null;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;

    if (!this.ctx) {
      this.ctx = new AudioCtx();
    }
    return this.ctx;
  }

  private ensureUiBus(ctx: AudioContext): GainNode {
    if (!this.uiGain) {
      const bus = ctx.createGain();
      bus.gain.setValueAtTime(this.isMuted || !this.uiSoundsEnabled ? 0 : 0.35, ctx.currentTime);
      bus.connect(ctx.destination);
      this.uiGain = bus;
      this.activeNodes.push(bus);
    }
    return this.uiGain;
  }

  public async unlockAndSync(
    muted: boolean,
    volume: number,
    uiSoundsEnabled = true,
    dimensionMode: 'hawkins' | 'upside-down' = 'hawkins',
    nostalgiaSynthEnabled = true
  ): Promise<void> {
    this.isMuted = muted;
    this.volume = volume;
    this.uiSoundsEnabled = uiSoundsEnabled;
    this.dimensionMode = dimensionMode;
    this.nostalgiaSynthEnabled = nostalgiaSynthEnabled;

    const ctx = this.ensureContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        return;
      }
    }

    this.ensureUiBus(ctx);

    if (!muted && !this.isStarted) {
      this.buildGraph(ctx);
      this.isStarted = true;
    }

    if (muted) {
      this.stopNostalgiaTheme();
    }

    this.applyGains();
  }

  public updateSettings(
    muted: boolean,
    volume: number,
    uiSoundsEnabled = true,
    dimensionMode: 'hawkins' | 'upside-down' = 'hawkins',
    nostalgiaSynthEnabled = true
  ): void {
    this.isMuted = muted;
    this.volume = volume;
    this.uiSoundsEnabled = uiSoundsEnabled;
    this.dimensionMode = dimensionMode;
    this.nostalgiaSynthEnabled = nostalgiaSynthEnabled;

    if (!muted && this.ctx && this.ctx.state === 'suspended') {
      void this.unlockAndSync(
        muted,
        volume,
        uiSoundsEnabled,
        dimensionMode,
        nostalgiaSynthEnabled
      );
      return;
    }
    if (!muted && !this.isStarted && this.ctx && this.ctx.state === 'running') {
      this.buildGraph(this.ctx);
      this.isStarted = true;
    }
    if (muted) {
      this.stopNostalgiaTheme();
    }
    this.applyGains();
  }

  private applyGains(): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    if (this.masterGain) {
      const baseGain = computeEffectiveAmbientGain(this.isMuted, this.volume);
      const target = this.dimensionMode === 'upside-down' ? baseGain * 1.2 : baseGain;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setTargetAtTime(target, now, 0.25);
    }

    if (this.rumbleFilter) {
      const cutoff = this.dimensionMode === 'upside-down' ? 128 : 88;
      this.rumbleFilter.frequency.setTargetAtTime(cutoff, now, 0.35);
    }

    if (this.uiGain) {
      const uiTarget =
        this.isMuted || !this.uiSoundsEnabled ? 0 : Math.min(0.45, 0.2 + this.volume * 0.28);
      this.uiGain.gain.cancelScheduledValues(now);
      this.uiGain.gain.setTargetAtTime(uiTarget, now, 0.08);
    }
  }

  private async prepareForUiSound(): Promise<{ ctx: AudioContext; bus: GainNode } | null> {
    if (this.isMuted || !this.uiSoundsEnabled) return null;
    const ctx = this.ensureContext();
    if (!ctx) return null;
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        return null;
      }
    }
    const bus = this.ensureUiBus(ctx);
    return { ctx, bus };
  }

  /** Crisp 1980s mechanical terminal switch click */
  public async playKeyClick(pitchOffset = 0): Promise<void> {
    const audio = await this.prepareForUiSound();
    if (!audio) return;
    const { ctx, bus } = audio;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520 + pitchOffset * 18, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.032);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.14, now);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);

    osc.connect(env);
    env.connect(bus);
    osc.start(now);
    osc.stop(now + 0.04);
  }

  /** Warm analog 1980s synth chime for Joyce's Alphabet Wall bulbs */
  public async playBulbChime(letterIndex: number): Promise<void> {
    const audio = await this.prepareForUiSound();
    if (!audio) return;
    const { ctx, bus } = audio;
    const now = ctx.currentTime;
    const freq = getSynthFrequencyForLetter(letterIndex);

    const osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(freq, now);

    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(freq * 1.004, now);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq * 4.2, now);
    filter.frequency.exponentialRampToValueAtTime(freq * 1.3, now + 0.45);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(0.2, now + 0.02);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(env);
    env.connect(bus);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.6);
    osc2.stop(now + 0.6);
  }

  /** Hawkins terminal transmission chirp (send prompt / start research) */
  public async playTransmit(): Promise<void> {
    const audio = await this.prepareForUiSound();
    if (!audio) return;
    const { ctx, bus } = audio;
    const now = ctx.currentTime;

    const notes = [261.63, 392.0, 523.25];
    notes.forEach((freq, idx) => {
      const start = now + idx * 0.048;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, start);
      env.gain.linearRampToValueAtTime(0.14, start + 0.015);
      env.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);

      osc.connect(env);
      env.connect(bus);
      osc.start(start);
      osc.stop(start + 0.18);
    });
  }

  /** CRT confirmation tone when AI response / synthesis completes */
  public async playReceiveChime(): Promise<void> {
    const audio = await this.prepareForUiSound();
    if (!audio) return;
    const { ctx, bus } = audio;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(311.13, now);
    osc.frequency.setValueAtTime(392.0, now + 0.08);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(0.16, now + 0.02);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);

    osc.connect(env);
    env.connect(bus);
    osc.start(now);
    osc.stop(now + 0.42);
  }

  /** Deep Hawkins metallic relay + dimensional shift pulse */
  public async playGateToggle(intoUpsideDown: boolean): Promise<void> {
    const audio = await this.prepareForUiSound();
    if (!audio) return;
    const { ctx, bus } = audio;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(intoUpsideDown ? 130 : 72, now);
    osc.frequency.exponentialRampToValueAtTime(intoUpsideDown ? 58 : 148, now + 0.35);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(380, now);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(0.24, now + 0.03);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);

    osc.connect(filter);
    filter.connect(env);
    env.connect(bus);
    osc.start(now);
    osc.stop(now + 0.45);
  }

  public stopNostalgiaTheme(): void {
    if (this.themeMasterGain && this.ctx) {
      try {
        this.themeMasterGain.gain.cancelScheduledValues(this.ctx.currentTime);
        this.themeMasterGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.04);
      } catch {
        // Ignore
      }
      this.themeMasterGain = null;
    }
    for (const osc of this.themeOscillators) {
      try {
        osc.stop();
        osc.disconnect();
      } catch {
        // Ignore
      }
    }
    this.themeOscillators = [];
  }

  /**
   * Iconic 1980s nostalgic analog synthesizer ostinato (Prophet-5 / Juno-60 style):
   * Dual detuned sawtooth+triangle pulsing Cmaj7 arpeggio, sweeping resonant lowpass filter,
   * warm analog tape echo, and sustained C2/G2 sub-bass pedal.
   */
  public async playNostalgiaTheme(cycles = 3): Promise<void> {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        return;
      }
    }

    this.stopNostalgiaTheme();

    const steps = getNostalgiaArpPattern(cycles);
    const stepSec = NOSTALGIA_ARP_STEP_MS / 1000;
    const totalSec = steps.length * stepSec;
    const now = ctx.currentTime;

    const themeMaster = ctx.createGain();
    const targetLevel = Math.max(0.18, Math.min(0.42, 0.22 + this.volume * 0.25));
    themeMaster.gain.setValueAtTime(0.0001, now);
    themeMaster.gain.linearRampToValueAtTime(targetLevel, now + 0.14);
    themeMaster.gain.setValueAtTime(targetLevel, now + totalSec);
    themeMaster.gain.exponentialRampToValueAtTime(0.0001, now + totalSec + 1.45);
    themeMaster.connect(ctx.destination);
    this.themeMasterGain = themeMaster;

    // Warm 1980s tape delay echo bus
    const delay = ctx.createDelay(1.0);
    delay.delayTime.setValueAtTime(stepSec * 1.5, now);
    const delayTone = ctx.createBiquadFilter();
    delayTone.type = 'lowpass';
    delayTone.frequency.setValueAtTime(1450, now);
    const delayFeedback = ctx.createGain();
    delayFeedback.gain.setValueAtTime(0.34, now);
    const delayWet = ctx.createGain();
    delayWet.gain.setValueAtTime(0.32, now);

    delay.connect(delayTone);
    delayTone.connect(delayFeedback);
    delayFeedback.connect(delay);
    delayTone.connect(delayWet);
    delayWet.connect(themeMaster);

    // Master sweeping analog lowpass bus that gradually opens across cycles
    const arpSweep = ctx.createBiquadFilter();
    arpSweep.type = 'lowpass';
    arpSweep.Q.setValueAtTime(2.6, now);
    arpSweep.frequency.setValueAtTime(420, now);
    arpSweep.frequency.linearRampToValueAtTime(1750, now + totalSec * 0.72);
    arpSweep.frequency.exponentialRampToValueAtTime(520, now + totalSec + 1.1);
    arpSweep.connect(themeMaster);
    arpSweep.connect(delay);

    // Warm sustained analog sub-bass pedal (C2 = 65.41Hz + G2 = 98.00Hz fifth)
    const bassFilter = ctx.createBiquadFilter();
    bassFilter.type = 'lowpass';
    bassFilter.frequency.setValueAtTime(210, now);
    bassFilter.Q.setValueAtTime(1.4, now);

    const bassEnv = ctx.createGain();
    bassEnv.gain.setValueAtTime(0.0001, now);
    bassEnv.gain.linearRampToValueAtTime(0.28, now + 0.45);
    bassEnv.gain.setValueAtTime(0.26, now + totalSec - 0.15);
    bassEnv.gain.exponentialRampToValueAtTime(0.0001, now + totalSec + 1.25);

    const bassRoot = ctx.createOscillator();
    bassRoot.type = 'sawtooth';
    bassRoot.frequency.setValueAtTime(65.41, now);

    const bassFifth = ctx.createOscillator();
    bassFifth.type = 'triangle';
    bassFifth.frequency.setValueAtTime(98.0, now);

    bassRoot.connect(bassFilter);
    bassFifth.connect(bassFilter);
    bassFilter.connect(bassEnv);
    bassEnv.connect(themeMaster);
    bassRoot.start(now);
    bassFifth.start(now);
    bassRoot.stop(now + totalSec + 1.35);
    bassFifth.stop(now + totalSec + 1.35);
    this.themeOscillators.push(bassRoot, bassFifth);

    // Schedule each 16th-note analog voice
    for (const step of steps) {
      const start = now + step.delayMs / 1000;
      const oscA = ctx.createOscillator();
      oscA.type = 'sawtooth';
      oscA.frequency.setValueAtTime(step.freq * 0.996, start);

      const oscB = ctx.createOscillator();
      oscB.type = 'triangle';
      oscB.frequency.setValueAtTime(step.freq * 1.005, start);

      const voiceFilter = ctx.createBiquadFilter();
      voiceFilter.type = 'lowpass';
      voiceFilter.Q.setValueAtTime(1.8, start);
      voiceFilter.frequency.setValueAtTime(step.freq * 6.2, start);
      voiceFilter.frequency.exponentialRampToValueAtTime(step.freq * 1.9, start + stepSec * 1.15);

      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, start);
      env.gain.linearRampToValueAtTime(0.16, start + 0.012);
      env.gain.exponentialRampToValueAtTime(0.0001, start + stepSec * 1.4);

      oscA.connect(voiceFilter);
      oscB.connect(voiceFilter);
      voiceFilter.connect(env);
      env.connect(arpSweep);

      oscA.start(start);
      oscB.start(start);
      oscA.stop(start + stepSec * 1.5);
      oscB.stop(start + stepSec * 1.5);
      this.themeOscillators.push(oscA, oscB);
    }
  }

  private buildGraph(ctx: AudioContext): void {
    const master = ctx.createGain();
    master.gain.setValueAtTime(0, ctx.currentTime);
    master.connect(ctx.destination);
    this.masterGain = master;
    this.activeNodes.push(master);

    // 1. Low-frequency seamless rumble bed
    const rumbleFilter = ctx.createBiquadFilter();
    rumbleFilter.type = 'lowpass';
    rumbleFilter.frequency.setValueAtTime(92, ctx.currentTime);
    rumbleFilter.Q.setValueAtTime(1.8, ctx.currentTime);
    this.rumbleFilter = rumbleFilter;

    const rumbleGain = ctx.createGain();
    rumbleGain.gain.setValueAtTime(0.42, ctx.currentTime);

    const subOsc1 = ctx.createOscillator();
    subOsc1.type = 'sine';
    subOsc1.frequency.setValueAtTime(36, ctx.currentTime);

    const subOsc2 = ctx.createOscillator();
    subOsc2.type = 'triangle';
    subOsc2.frequency.setValueAtTime(53.5, ctx.currentTime);

    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.075, ctx.currentTime);
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.setValueAtTime(28, ctx.currentTime);
    lfo.connect(lfoDepth);
    lfoDepth.connect(rumbleFilter.frequency);

    subOsc1.connect(rumbleFilter);
    subOsc2.connect(rumbleFilter);
    rumbleFilter.connect(rumbleGain);
    rumbleGain.connect(master);

    subOsc1.start();
    subOsc2.start();
    lfo.start();
    this.oscillators.push(subOsc1, subOsc2, lfo);
    this.activeNodes.push(rumbleFilter, rumbleGain, lfoDepth);

    // 2. Seamless faint crackling energy loop
    const sampleRate = ctx.sampleRate;
    const durationSec = 4;
    const length = sampleRate * durationSec;
    const crackleBuffer = ctx.createBuffer(1, length, sampleRate);
    const data = crackleBuffer.getChannelData(0);

    for (let i = 0; i < length; i += 1) {
      const baseAir = (Math.random() * 2 - 1) * 0.018;
      const spark = Math.random() < 0.0014 ? (Math.random() * 2 - 1) * 0.55 : 0;
      data[i] = baseAir + spark;
    }

    const fadeSamples = Math.min(1024, Math.floor(length * 0.05));
    for (let i = 0; i < fadeSamples; i += 1) {
      const w = i / fadeSamples;
      data[i] *= w;
      data[length - 1 - i] *= w;
    }

    const crackleSource = ctx.createBufferSource();
    crackleSource.buffer = crackleBuffer;
    crackleSource.loop = true;

    const crackleBandpass = ctx.createBiquadFilter();
    crackleBandpass.type = 'bandpass';
    crackleBandpass.frequency.setValueAtTime(2100, ctx.currentTime);
    crackleBandpass.Q.setValueAtTime(2.2, ctx.currentTime);

    const crackleGain = ctx.createGain();
    crackleGain.gain.setValueAtTime(0.14, ctx.currentTime);

    crackleSource.connect(crackleBandpass);
    crackleBandpass.connect(crackleGain);
    crackleGain.connect(master);
    crackleSource.start();
    this.bufferSources.push(crackleSource);
    this.activeNodes.push(crackleBandpass, crackleGain);

    // 3. Occasional distant distorted sounds
    this.scheduleDistantAnomaly();
  }

  private createSoftDistortionCurve(amount = 28): Float32Array {
    const samples = 256;
    const curve = new Float32Array(samples);
    for (let i = 0; i < samples; i += 1) {
      const x = (i * 2) / samples - 1;
      curve[i] = ((3 + amount) * x * 20 * (Math.PI / 180)) / (Math.PI + amount * Math.abs(x));
    }
    return curve;
  }

  private triggerDistantDistortedEcho(): void {
    if (!this.ctx || !this.masterGain || this.isMuted || this.ctx.state !== 'running') {
      return;
    }
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    const baseFreq = this.dimensionMode === 'upside-down' ? 54 + Math.random() * 40 : 68 + Math.random() * 48;
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.62, now + 2.4);

    const shaper = ctx.createWaveShaper();
    shaper.curve = this.createSoftDistortionCurve(24) as unknown as Float32Array<ArrayBuffer>;
    shaper.oversample = '2x';

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(340, now);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(0.085, now + 0.7);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 2.8);

    const delay = ctx.createDelay(1.0);
    delay.delayTime.setValueAtTime(0.36, now);
    const delayFeedback = ctx.createGain();
    delayFeedback.gain.setValueAtTime(0.32, now);

    const panner = ctx.createStereoPanner();
    panner.pan.setValueAtTime((Math.random() - 0.5) * 1.2, now);

    osc.connect(shaper);
    shaper.connect(lp);
    lp.connect(env);
    env.connect(panner);
    env.connect(delay);
    delay.connect(delayFeedback);
    delayFeedback.connect(delay);
    delay.connect(panner);
    panner.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 3.0);
    osc.onended = () => {
      osc.disconnect();
      shaper.disconnect();
      lp.disconnect();
      env.disconnect();
      delay.disconnect();
      delayFeedback.disconnect();
      panner.disconnect();
    };
  }

  private triggerNostalgiaPadShimmer(): void {
    if (
      !this.ctx ||
      !this.masterGain ||
      this.isMuted ||
      !this.nostalgiaSynthEnabled ||
      this.ctx.state !== 'running'
    ) {
      return;
    }
    const ctx = this.ctx;
    const now = ctx.currentTime;
    // Soft nostalgic 1980s analog warm Cmaj7 pad swell underneath ambient soundscape
    const padNotes = [130.81, 196.0, 246.94];
    const padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.setValueAtTime(320, now);
    padFilter.frequency.linearRampToValueAtTime(760, now + 2.2);
    padFilter.frequency.exponentialRampToValueAtTime(280, now + 5.2);

    const padEnv = ctx.createGain();
    padEnv.gain.setValueAtTime(0.0001, now);
    padEnv.gain.linearRampToValueAtTime(0.065, now + 1.6);
    padEnv.gain.exponentialRampToValueAtTime(0.0001, now + 5.4);

    padFilter.connect(padEnv);
    padEnv.connect(this.masterGain);

    padNotes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      osc.type = idx === 0 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(freq * (idx === 1 ? 1.003 : 0.998), now);
      osc.connect(padFilter);
      osc.start(now);
      osc.stop(now + 5.6);
      osc.onended = () => {
        osc.disconnect();
        if (idx === padNotes.length - 1) {
          padFilter.disconnect();
          padEnv.disconnect();
        }
      };
    });
  }

  private scheduleDistantAnomaly(): void {
    if (this.distantTimerId !== null) {
      window.clearTimeout(this.distantTimerId);
    }
    const nextDelayMs = 11000 + Math.random() * 11000;
    this.distantTimerId = window.setTimeout(() => {
      if (this.nostalgiaSynthEnabled && Math.random() < 0.45) {
        this.triggerNostalgiaPadShimmer();
      } else {
        this.triggerDistantDistortedEcho();
      }
      this.scheduleDistantAnomaly();
    }, nextDelayMs);
  }

  public dispose(): void {
    this.stopNostalgiaTheme();
    if (this.distantTimerId !== null) {
      window.clearTimeout(this.distantTimerId);
      this.distantTimerId = null;
    }
    for (const osc of this.oscillators) {
      try {
        osc.stop();
        osc.disconnect();
      } catch {
        // Ignore already stopped
      }
    }
    for (const src of this.bufferSources) {
      try {
        src.stop();
        src.disconnect();
      } catch {
        // Ignore
      }
    }
    for (const node of this.activeNodes) {
      try {
        node.disconnect();
      } catch {
        // Ignore
      }
    }
    this.oscillators = [];
    this.bufferSources = [];
    this.activeNodes = [];
    this.rumbleFilter = null;
    this.uiGain = null;
    this.isStarted = false;

    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
    this.masterGain = null;
  }
}
