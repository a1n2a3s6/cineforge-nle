import { TimelineTrack } from '../../types/timeline';

interface TrackAudioChain {
  input: GainNode;
  eqLow: BiquadFilterNode;
  eqMid: BiquadFilterNode;
  eqHigh: BiquadFilterNode;
  compressor: DynamicsCompressorNode;
  panner: StereoPannerNode;
  fader: GainNode;
  analyser: AnalyserNode;
  meterBuffer: Float32Array;
  compressorActive: boolean;
}

class MultiTrackAudioMixer {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private masterAnalyser: AnalyserNode | null = null;
  private masterBuffer: Float32Array = new Float32Array(256);
  private trackChains = new Map<string, TrackAudioChain>();
  private sourceNodes = new WeakMap<HTMLAudioElement, MediaElementAudioSourceNode>();
  private elementTrackBinding = new WeakMap<HTMLAudioElement, string>();

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterAnalyser = this.ctx.createAnalyser();
      this.masterAnalyser.fftSize = 256;
      this.masterBuffer = new Float32Array(this.masterAnalyser.fftSize);
      this.masterGain.connect(this.masterAnalyser);
      this.masterAnalyser.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private getOrCreateTrackChain(trackId: string): TrackAudioChain | null {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return null;

    const existing = this.trackChains.get(trackId);
    if (existing) return existing;

    const input = ctx.createGain();
    const eqLow = ctx.createBiquadFilter();
    eqLow.type = 'lowshelf';
    eqLow.frequency.value = 120;

    const eqMid = ctx.createBiquadFilter();
    eqMid.type = 'peaking';
    eqMid.frequency.value = 1000;
    eqMid.Q.value = 1.0;

    const eqHigh = ctx.createBiquadFilter();
    eqHigh.type = 'highshelf';
    eqHigh.frequency.value = 8000;

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 12;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.006;
    compressor.release.value = 0.16;

    const panner = ctx.createStereoPanner();
    const fader = ctx.createGain();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;

    input.connect(eqLow);
    eqLow.connect(eqMid);
    eqMid.connect(eqHigh);
    eqHigh.connect(panner);
    panner.connect(fader);
    fader.connect(analyser);
    analyser.connect(this.masterGain);

    const chain: TrackAudioChain = {
      input,
      eqLow,
      eqMid,
      eqHigh,
      compressor,
      panner,
      fader,
      analyser,
      meterBuffer: new Float32Array(analyser.fftSize),
      compressorActive: false,
    };

    this.trackChains.set(trackId, chain);
    return chain;
  }

  public routeAudioElement(el: HTMLAudioElement, trackId: string): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const chain = this.getOrCreateTrackChain(trackId);
    if (!chain) return;

    let src = this.sourceNodes.get(el);
    if (!src) {
      src = ctx.createMediaElementSource(el);
      this.sourceNodes.set(el, src);
    }

    const currentTrack = this.elementTrackBinding.get(el);
    if (currentTrack !== trackId) {
      try {
        src.disconnect();
      } catch {
        // Ignore if not previously connected
      }
      src.connect(chain.input);
      this.elementTrackBinding.set(el, trackId);
    }
  }

  public syncTrackParams(track: TimelineTrack, isAudible: boolean): void {
    const chain = this.getOrCreateTrackChain(track.id);
    if (!chain || !this.ctx) return;

    const now = this.ctx.currentTime;
    chain.eqLow.gain.setTargetAtTime(track.eqLow, now, 0.02);
    chain.eqMid.gain.setTargetAtTime(track.eqMid, now, 0.02);
    chain.eqHigh.gain.setTargetAtTime(track.eqHigh, now, 0.02);
    chain.panner.pan.setTargetAtTime(track.pan, now, 0.02);
    chain.fader.gain.setTargetAtTime(isAudible ? track.volume : 0, now, 0.015);

    if (track.compressorEnabled !== chain.compressorActive) {
      chain.eqHigh.disconnect();
      chain.compressor.disconnect();
      if (track.compressorEnabled) {
        chain.eqHigh.connect(chain.compressor);
        chain.compressor.connect(chain.panner);
      } else {
        chain.eqHigh.connect(chain.panner);
      }
      chain.compressorActive = track.compressorEnabled;
    }
  }

  private computeRmsDb(analyser: AnalyserNode, buffer: Float32Array): number {
    analyser.getFloatTimeDomainData(buffer);
    let sumSq = 0;
    for (let i = 0; i < buffer.length; i += 1) {
      sumSq += buffer[i] * buffer[i];
    }
    const rms = Math.sqrt(sumSq / buffer.length);
    if (rms <= 0.0001) return -60;
    return Math.max(-60, Math.min(0, 20 * Math.log10(rms)));
  }

  public getTrackLevelDb(trackId: string): number {
    const chain = this.trackChains.get(trackId);
    if (!chain) return -60;
    return this.computeRmsDb(chain.analyser, chain.meterBuffer);
  }

  public getMasterLevelDb(): number {
    if (!this.masterAnalyser) return -60;
    return this.computeRmsDb(this.masterAnalyser, this.masterBuffer);
  }
}

export const audioMixer = new MultiTrackAudioMixer();
