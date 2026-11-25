import { BeatMarker, CaptionSegment, DEFAULT_CAPTION_STYLE } from '../types/ai';
import {
  DEFAULT_CHROMA_KEY,
  DEFAULT_COLOR_GRADE,
  DEFAULT_GPU_FX,
  DEFAULT_TRANSFORM,
} from '../types/effects';
import {
  MediaAsset,
  ProjectSnapshot,
  SyntheticPattern,
  TimelineClip,
  TimelineTrack,
} from '../types/timeline';
import { uid } from './timecode';

function encodeWavBlob(samples: Float32Array, sampleRate: number): Blob {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i += 1) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i += 1) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function extractPeaks(samples: Float32Array, bins = 96): number[] {
  const step = Math.max(1, Math.floor(samples.length / bins));
  const peaks: number[] = [];
  for (let i = 0; i < bins; i += 1) {
    let max = 0;
    const start = i * step;
    const end = Math.min(samples.length, start + step);
    for (let j = start; j < end; j += 1) {
      const abs = Math.abs(samples[j]);
      if (abs > max) max = abs;
    }
    peaks.push(Number(max.toFixed(3)));
  }
  return peaks;
}

function generateSynthAudio(
  durationSec: number,
  bpm: number,
  variant: 'pulse' | 'ambient'
): { url: string; peaks: number[]; size: number } {
  const sampleRate = 22050;
  const totalSamples = Math.floor(sampleRate * durationSec);
  const samples = new Float32Array(totalSamples);
  const beatDur = 60 / bpm;

  for (let i = 0; i < totalSamples; i += 1) {
    const t = i / sampleRate;
    const beatPhase = (t % beatDur) / beatDur;

    if (variant === 'pulse') {
      const kickEnv = Math.exp(-beatPhase * 14);
      const kickFreq = 52 + 95 * Math.exp(-beatPhase * 28);
      const kick = Math.sin(2 * Math.PI * kickFreq * t) * kickEnv * 0.55;

      const bassNotes = [55, 55, 65.41, 73.42];
      const barIdx = Math.floor(t / (beatDur * 2)) % bassNotes.length;
      const bass = Math.sin(2 * Math.PI * bassNotes[barIdx] * t) * 0.22;

      const hihat =
        beatPhase > 0.48 && beatPhase < 0.56
          ? Math.sin(t * 9431) * 0.14 * Math.exp(-(beatPhase - 0.48) * 45)
          : 0;

      samples[i] = Math.tanh((kick + bass + hihat) * 0.9);
    } else {
      const env = Math.min(1, t / 0.6) * Math.min(1, (durationSec - t) / 0.8);
      const pad =
        (Math.sin(2 * Math.PI * 220 * t) * 0.22 +
          Math.sin(2 * Math.PI * 277.18 * t) * 0.16 +
          Math.sin(2 * Math.PI * 329.63 * t) * 0.16 +
          Math.sin(2 * Math.PI * 440 * t) * 0.1) *
        (0.75 + 0.25 * Math.sin(2 * Math.PI * 0.35 * t));
      samples[i] = pad * env * 0.6;
    }
  }

  const blob = encodeWavBlob(samples, sampleRate);
  return {
    url: URL.createObjectURL(blob),
    peaks: extractPeaks(samples, 110),
    size: blob.size,
  };
}

export function renderSyntheticFrame(
  ctx: CanvasRenderingContext2D,
  pattern: SyntheticPattern,
  width: number,
  height: number,
  localTime: number
): void {
  if (pattern === 'broadcast-bars') {
    const colors = ['#E5E7EB', '#F59E0B', '#06B6D4', '#10B981', '#D97706', '#EF4444', '#1E3A8A'];
    const barW = width / colors.length;
    colors.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.fillRect(i * barW, 0, barW + 1, height * 0.72);
    });

    ctx.fillStyle = '#0A0B0E';
    ctx.fillRect(0, height * 0.72, width, height * 0.28);

    const sweepX = ((localTime * 0.35) % 1) * width;
    ctx.fillStyle = 'rgba(6, 182, 212, 0.22)';
    ctx.fillRect(sweepX - 3, 0, 6, height);

    ctx.fillStyle = '#F59E0B';
    ctx.font = `700 ${Math.max(12, Math.floor(height * 0.045))}px monospace`;
    ctx.textAlign = 'left';
    ctx.fillText('CINEFORGE PRO // SMPTE TEST SIGNAL', width * 0.04, height * 0.84);
    ctx.fillStyle = '#06B6D4';
    ctx.fillText(`T+${localTime.toFixed(2)}s`, width * 0.04, height * 0.92);
    return;
  }

  if (pattern === 'kinetic-grid') {
    ctx.fillStyle = '#0B0F17';
    ctx.fillRect(0, 0, width, height);

    const horizonY = height * 0.45;
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.45)';
    ctx.lineWidth = Math.max(1, width * 0.0015);

    for (let i = -8; i <= 8; i += 1) {
      ctx.beginPath();
      ctx.moveTo(width * 0.5 + i * width * 0.04, horizonY);
      ctx.lineTo(width * 0.5 + i * width * 0.22, height);
      ctx.stroke();
    }

    const speedOffset = (localTime * 1.4) % 1;
    for (let i = 0; i < 12; i += 1) {
      const p = ((i + speedOffset) / 12) ** 2;
      const y = horizonY + p * (height - horizonY);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    const cx = width * 0.5;
    const cy = height * 0.3;
    const r = Math.min(width, height) * (0.14 + Math.sin(localTime * 2.5) * 0.012);
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = Math.max(2, width * 0.003);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#10B981';
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.62, localTime * 1.6, localTime * 1.6 + Math.PI * 1.25);
    ctx.stroke();
    return;
  }

  if (pattern === 'cinema-gradient') {
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#0F172A');
    grad.addColorStop(0.5, '#134E4A');
    grad.addColorStop(1, '#1C1917');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    for (let i = 0; i < 5; i += 1) {
      const px = (((i * 0.23 + localTime * 0.08) % 1.2) - 0.1) * width;
      const py = height * (0.2 + i * 0.15);
      ctx.fillStyle = i % 2 === 0 ? 'rgba(245, 158, 11, 0.16)' : 'rgba(6, 182, 212, 0.16)';
      ctx.fillRect(px, py, width * 0.26, height * 0.06);
    }
    return;
  }

  ctx.strokeStyle = 'rgba(16, 185, 129, 0.85)';
  ctx.lineWidth = Math.max(1.5, width * 0.002);
  const pad = width * 0.04;
  const corner = width * 0.035;

  ctx.beginPath();
  ctx.moveTo(pad, pad + corner);
  ctx.lineTo(pad, pad);
  ctx.lineTo(pad + corner, pad);
  ctx.moveTo(width - pad - corner, pad);
  ctx.lineTo(width - pad, pad);
  ctx.lineTo(width - pad, pad + corner);
  ctx.moveTo(pad, height - pad - corner);
  ctx.lineTo(pad, height - pad);
  ctx.lineTo(pad + corner, height - pad);
  ctx.moveTo(width - pad - corner, height - pad);
  ctx.lineTo(width - pad, height - pad);
  ctx.lineTo(width - pad, height - pad - corner);
  ctx.stroke();

  const blink = Math.floor(localTime * 2) % 2 === 0;
  ctx.fillStyle = blink ? '#EF4444' : 'rgba(239, 68, 68, 0.35)';
  ctx.beginPath();
  ctx.arc(pad + 18, pad + 20, Math.max(4, width * 0.005), 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#E4E4E7';
  ctx.font = `600 ${Math.max(10, Math.floor(height * 0.028))}px monospace`;
  ctx.textAlign = 'left';
  ctx.fillText('REC  RAW-PROXY  60FPS', pad + 32, pad + 24);
}

function makeSyntheticThumbnail(pattern: SyntheticPattern): string {
  const canvas = document.createElement('canvas');
  canvas.width = 192;
  canvas.height = 108;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    renderSyntheticFrame(ctx, pattern, 192, 108, 1.25);
  }
  return canvas.toDataURL('image/png');
}

export function buildSyntheticDemoProject(): {
  assets: MediaAsset[];
  snapshot: ProjectSnapshot;
} {
  const now = Date.now();
  const pulseAudio = generateSynthAudio(16, 120, 'pulse');
  const ambientAudio = generateSynthAudio(14, 120, 'ambient');

  const assetBars: MediaAsset = {
    id: uid('asset'),
    name: 'SMPTE_Broadcast_Intro.syn',
    kind: 'synthetic',
    mimeType: 'video/x-cineforge-synthetic',
    url: '',
    duration: 6,
    width: 1920,
    height: 1080,
    fps: 30,
    fileSize: 0,
    syntheticPattern: 'broadcast-bars',
    thumbnailUrl: makeSyntheticThumbnail('broadcast-bars'),
    createdAt: now,
  };

  const assetGrid: MediaAsset = {
    id: uid('asset'),
    name: 'Kinetic_Horizon_Grid.syn',
    kind: 'synthetic',
    mimeType: 'video/x-cineforge-synthetic',
    url: '',
    duration: 8,
    width: 1920,
    height: 1080,
    fps: 30,
    fileSize: 0,
    syntheticPattern: 'kinetic-grid',
    thumbnailUrl: makeSyntheticThumbnail('kinetic-grid'),
    createdAt: now,
  };

  const assetCinema: MediaAsset = {
    id: uid('asset'),
    name: 'Anamorphic_Teal_Plates.syn',
    kind: 'synthetic',
    mimeType: 'video/x-cineforge-synthetic',
    url: '',
    duration: 6,
    width: 1920,
    height: 1080,
    fps: 30,
    fileSize: 0,
    syntheticPattern: 'cinema-gradient',
    thumbnailUrl: makeSyntheticThumbnail('cinema-gradient'),
    createdAt: now,
  };

  const assetHud: MediaAsset = {
    id: uid('asset'),
    name: 'Camera_HUD_Overlay.syn',
    kind: 'synthetic',
    mimeType: 'video/x-cineforge-synthetic',
    url: '',
    duration: 12,
    width: 1920,
    height: 1080,
    fps: 30,
    fileSize: 0,
    syntheticPattern: 'telemetry-overlay',
    thumbnailUrl: makeSyntheticThumbnail('telemetry-overlay'),
    createdAt: now,
  };

  const assetBeat: MediaAsset = {
    id: uid('asset'),
    name: 'Broadcast_120BPM_Pulse.wav',
    kind: 'audio',
    mimeType: 'audio/wav',
    url: pulseAudio.url,
    duration: 16,
    width: 0,
    height: 0,
    fps: 0,
    fileSize: pulseAudio.size,
    waveformPeaks: pulseAudio.peaks,
    createdAt: now,
  };

  const assetPad: MediaAsset = {
    id: uid('asset'),
    name: 'Analog_Sub_Pad.wav',
    kind: 'audio',
    mimeType: 'audio/wav',
    url: ambientAudio.url,
    duration: 14,
    width: 0,
    height: 0,
    fps: 0,
    fileSize: ambientAudio.size,
    waveformPeaks: ambientAudio.peaks,
    createdAt: now,
  };

  const tracks: TimelineTrack[] = [
    { id: 'track_t1', name: 'T1', type: 'text', index: 0, height: 48, muted: false, solo: false, locked: false, visible: true, volume: 1, pan: 0, eqLow: 0, eqMid: 0, eqHigh: 0, compressorEnabled: false },
    { id: 'track_v2', name: 'V2', type: 'video', index: 1, height: 56, muted: false, solo: false, locked: false, visible: true, volume: 1, pan: 0, eqLow: 0, eqMid: 0, eqHigh: 0, compressorEnabled: false },
    { id: 'track_v1', name: 'V1', type: 'video', index: 2, height: 64, muted: false, solo: false, locked: false, visible: true, volume: 1, pan: 0, eqLow: 0, eqMid: 0, eqHigh: 0, compressorEnabled: false },
    { id: 'track_a1', name: 'A1', type: 'audio', index: 3, height: 56, muted: false, solo: false, locked: false, visible: true, volume: 0.9, pan: 0, eqLow: 2, eqMid: 0, eqHigh: 1, compressorEnabled: true },
    { id: 'track_a2', name: 'A2', type: 'audio', index: 4, height: 52, muted: false, solo: false, locked: false, visible: true, volume: 0.65, pan: -0.15, eqLow: -1, eqMid: 1, eqHigh: 2, compressorEnabled: false },
  ];

  const clips: TimelineClip[] = [
    {
      id: uid('clip'),
      trackId: 'track_v1',
      assetId: assetBars.id,
      name: assetBars.name,
      kind: 'video',
      startTime: 0,
      duration: 4.5,
      trimIn: 0,
      trimOut: 4.5,
      sourceDuration: assetBars.duration,
      speed: 1,
      volume: 1,
      muted: false,
      locked: false,
      colorTag: '#06B6D4',
      transform: { ...DEFAULT_TRANSFORM },
      colorGrade: { ...DEFAULT_COLOR_GRADE },
      chromaKey: { ...DEFAULT_CHROMA_KEY },
      gpuFx: { ...DEFAULT_GPU_FX },
      keyframes: {},
      transitions: [],
      effects: [],
    },
    {
      id: uid('clip'),
      trackId: 'track_v1',
      assetId: assetGrid.id,
      name: assetGrid.name,
      kind: 'video',
      startTime: 4.5,
      duration: 6.5,
      trimIn: 0,
      trimOut: 6.5,
      sourceDuration: assetGrid.duration,
      speed: 1,
      volume: 1,
      muted: false,
      locked: false,
      colorTag: '#06B6D4',
      transform: { ...DEFAULT_TRANSFORM },
      colorGrade: { ...DEFAULT_COLOR_GRADE },
      chromaKey: { ...DEFAULT_CHROMA_KEY },
      gpuFx: { ...DEFAULT_GPU_FX },
      keyframes: {},
      transitions: [{ id: uid('tr'), type: 'cross-dissolve', duration: 0.6, edge: 'in' }],
      effects: [],
    },
    {
      id: uid('clip'),
      trackId: 'track_v1',
      assetId: assetCinema.id,
      name: assetCinema.name,
      kind: 'video',
      startTime: 11,
      duration: 5,
      trimIn: 0,
      trimOut: 5,
      sourceDuration: assetCinema.duration,
      speed: 1,
      volume: 1,
      muted: false,
      locked: false,
      colorTag: '#06B6D4',
      transform: { ...DEFAULT_TRANSFORM },
      colorGrade: { ...DEFAULT_COLOR_GRADE },
      chromaKey: { ...DEFAULT_CHROMA_KEY },
      gpuFx: { ...DEFAULT_GPU_FX },
      keyframes: {},
      transitions: [],
      effects: [],
    },
    {
      id: uid('clip'),
      trackId: 'track_v2',
      assetId: assetHud.id,
      name: assetHud.name,
      kind: 'video',
      startTime: 1.5,
      duration: 12,
      trimIn: 0,
      trimOut: 12,
      sourceDuration: assetHud.duration,
      speed: 1,
      volume: 1,
      muted: false,
      locked: false,
      colorTag: '#10B981',
      transform: { ...DEFAULT_TRANSFORM },
      colorGrade: { ...DEFAULT_COLOR_GRADE },
      chromaKey: { ...DEFAULT_CHROMA_KEY },
      gpuFx: { ...DEFAULT_GPU_FX },
      keyframes: {},
      transitions: [],
      effects: [],
    },
    {
      id: uid('clip'),
      trackId: 'track_t1',
      assetId: null,
      name: 'Title: CINEFORGE PRO',
      kind: 'text',
      startTime: 0.5,
      duration: 4,
      trimIn: 0,
      trimOut: 4,
      sourceDuration: 60,
      speed: 1,
      volume: 1,
      muted: false,
      locked: false,
      colorTag: '#F59E0B',
      transform: { ...DEFAULT_TRANSFORM, y: 0.25 },
      colorGrade: { ...DEFAULT_COLOR_GRADE },
      chromaKey: { ...DEFAULT_CHROMA_KEY },
      gpuFx: { ...DEFAULT_GPU_FX },
      keyframes: {},
      transitions: [],
      effects: [],
      textData: {
        content: 'CINEFORGE PRO // 60FPS PROXY ENGINE',
        fontFamily: 'Inter, sans-serif',
        fontSize: 44,
        fontWeight: 800,
        color: '#F59E0B',
        backgroundColor: 'rgba(10, 11, 14, 0.78)',
        align: 'center',
      },
    },
    {
      id: uid('clip'),
      trackId: 'track_t1',
      assetId: null,
      name: 'Lower Third: Cut & Trim',
      kind: 'text',
      startTime: 5.5,
      duration: 5,
      trimIn: 0,
      trimOut: 5,
      sourceDuration: 60,
      speed: 1,
      volume: 1,
      muted: false,
      locked: false,
      colorTag: '#F59E0B',
      transform: { ...DEFAULT_TRANSFORM, y: 0.34 },
      colorGrade: { ...DEFAULT_COLOR_GRADE },
      chromaKey: { ...DEFAULT_CHROMA_KEY },
      gpuFx: { ...DEFAULT_GPU_FX },
      keyframes: {},
      transitions: [],
      effects: [],
      textData: {
        content: 'PRESS [C] RAZOR · [V] SELECT · [SPACE] PLAY',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 32,
        fontWeight: 700,
        color: '#E4E4E7',
        backgroundColor: 'rgba(10, 11, 14, 0.85)',
        align: 'center',
      },
    },
    {
      id: uid('clip'),
      trackId: 'track_a1',
      assetId: assetBeat.id,
      name: assetBeat.name,
      kind: 'audio',
      startTime: 0,
      duration: 16,
      trimIn: 0,
      trimOut: 16,
      sourceDuration: assetBeat.duration,
      speed: 1,
      volume: 0.85,
      muted: false,
      locked: false,
      colorTag: '#10B981',
      transform: { ...DEFAULT_TRANSFORM },
      colorGrade: { ...DEFAULT_COLOR_GRADE },
      chromaKey: { ...DEFAULT_CHROMA_KEY },
      gpuFx: { ...DEFAULT_GPU_FX },
      keyframes: {},
      transitions: [],
      effects: [],
    },
    {
      id: uid('clip'),
      trackId: 'track_a2',
      assetId: assetPad.id,
      name: assetPad.name,
      kind: 'audio',
      startTime: 2,
      duration: 14,
      trimIn: 0,
      trimOut: 14,
      sourceDuration: assetPad.duration,
      speed: 1,
      volume: 0.55,
      muted: false,
      locked: false,
      colorTag: '#10B981',
      transform: { ...DEFAULT_TRANSFORM },
      colorGrade: { ...DEFAULT_COLOR_GRADE },
      chromaKey: { ...DEFAULT_CHROMA_KEY },
      gpuFx: { ...DEFAULT_GPU_FX },
      keyframes: {},
      transitions: [],
      effects: [],
    },
  ];

  const beatMarkers: BeatMarker[] = [];
  for (let i = 0; i <= 32; i += 1) {
    const time = i * 0.5;
    const isDownbeat = i % 4 === 0;
    beatMarkers.push({
      id: uid('beat'),
      time,
      strength: isDownbeat ? 1 : 0.55,
      label: isDownbeat ? `BAR ${i / 4 + 1}` : undefined,
      color: isDownbeat ? '#F59E0B' : '#06B6D4',
      isDownbeat,
    });
  }

  const captions: CaptionSegment[] = [
    {
      id: uid('cap'),
      trackId: 'track_t1',
      startTime: 11.2,
      endTime: 15.5,
      text: 'LOW-RAM PROXY SCALING READY FOR EXPORT',
      words: [
        { word: 'LOW-RAM', start: 11.2, end: 12.1, confidence: 0.99 },
        { word: 'PROXY', start: 12.1, end: 12.9, confidence: 0.99 },
        { word: 'SCALING', start: 12.9, end: 13.8, confidence: 0.99 },
        { word: 'READY', start: 13.8, end: 14.6, confidence: 0.99 },
        { word: 'FOR EXPORT', start: 14.6, end: 15.5, confidence: 0.99 },
      ],
      style: { ...DEFAULT_CAPTION_STYLE },
    },
  ];

  return {
    assets: [assetBars, assetGrid, assetCinema, assetHud, assetBeat, assetPad],
    snapshot: { tracks, clips, beatMarkers, captions },
  };
}
