import { computeEffectiveAmbientGain } from './labLogic';

/**
 * Procedural Web Audio soundscape inspired by the Upside Down:
 * - Seamless low-frequency sub-bass rumbles (detuned oscillators + slow LFO filter sweep)
 * - Faint bio-electric crackling energy loop (sparse micro-impulses through bandpass filter)
 * - Occasional distant distorted echoes (waveshaper + low-pass + feedback delay)
 */
export class UpsideDownSoundscape {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isStarted = false;
  private isMuted = false;
  private volume = 0.45;
  private distantTimerId: number | null = null;
  private activeNodes: AudioNode[] = [];
  private oscillators: OscillatorNode[] = [];
  private bufferSources: AudioBufferSourceNode[] = [];

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

  public async unlockAndSync(muted: boolean, volume: number): Promise<void> {
    this.isMuted = muted;
    this.volume = volume;

    if (muted) {
      this.applyMasterGain();
      return;
    }

    const ctx = this.ensureContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        // Browser may require direct user gesture first
        return;
      }
    }

    if (!this.isStarted) {
      this.buildGraph(ctx);
      this.isStarted = true;
    }

    this.applyMasterGain();
  }

  public updateSettings(muted: boolean, volume: number): void {
    this.isMuted = muted;
    this.volume = volume;
    if (!muted && this.ctx && this.ctx.state === 'suspended') {
      void this.unlockAndSync(muted, volume);
      return;
    }
    if (!muted && !this.isStarted && this.ctx && this.ctx.state === 'running') {
      this.buildGraph(this.ctx);
      this.isStarted = true;
    }
    this.applyMasterGain();
  }

  private applyMasterGain(): void {
    if (!this.ctx || !this.masterGain) return;
    const target = computeEffectiveAmbientGain(this.isMuted, this.volume);
    const now = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setTargetAtTime(target, now, 0.25);
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

    const rumbleGain = ctx.createGain();
    rumbleGain.gain.setValueAtTime(0.42, ctx.currentTime);

    const subOsc1 = ctx.createOscillator();
    subOsc1.type = 'sine';
    subOsc1.frequency.setValueAtTime(36, ctx.currentTime);

    const subOsc2 = ctx.createOscillator();
    subOsc2.type = 'triangle';
    subOsc2.frequency.setValueAtTime(53.5, ctx.currentTime);

    // Slow breathing LFO modulating filter frequency
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

    // 2. Seamless faint crackling energy loop (4-second procedural buffer with edge crossfade)
    const sampleRate = ctx.sampleRate;
    const durationSec = 4;
    const length = sampleRate * durationSec;
    const crackleBuffer = ctx.createBuffer(1, length, sampleRate);
    const data = crackleBuffer.getChannelData(0);

    for (let i = 0; i < length; i += 1) {
      // Very sparse static dust + occasional micro-arc crackle
      const baseAir = (Math.random() * 2 - 1) * 0.018;
      const spark = Math.random() < 0.0014 ? (Math.random() * 2 - 1) * 0.55 : 0;
      data[i] = baseAir + spark;
    }

    // Smooth crossfade at loop boundaries to guarantee zero click
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
    const baseFreq = 68 + Math.random() * 48;
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

  private scheduleDistantAnomaly(): void {
    if (this.distantTimerId !== null) {
      window.clearTimeout(this.distantTimerId);
    }
    const nextDelayMs = 11000 + Math.random() * 11000;
    this.distantTimerId = window.setTimeout(() => {
      this.triggerDistantDistortedEcho();
      this.scheduleDistantAnomaly();
    }, nextDelayMs);
  }

  public dispose(): void {
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
    this.isStarted = false;

    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
    this.masterGain = null;
  }
}
