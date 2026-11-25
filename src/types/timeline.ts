import {
  ChromaKeyParams,
  ClipEffect,
  ClipTransform,
  ClipTransition,
  ColorGradeParams,
  GpuFxParams,
  Keyframe,
} from './effects';
import { BeatMarker, CaptionSegment } from './ai';

export type TrackType = 'video' | 'audio' | 'text' | 'adjustment';

export type MediaAssetKind = 'video' | 'audio' | 'image' | 'synthetic';

export type SyntheticPattern =
  | 'broadcast-bars'
  | 'kinetic-grid'
  | 'telemetry-overlay'
  | 'cinema-gradient';

export interface MediaAsset {
  id: string;
  name: string;
  kind: MediaAssetKind;
  mimeType: string;
  url: string;
  duration: number;
  width: number;
  height: number;
  fps: number;
  fileSize: number;
  thumbnailUrl?: string;
  waveformPeaks?: number[];
  syntheticPattern?: SyntheticPattern;
  createdAt: number;
}

export interface TextClipData {
  content: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  backgroundColor: string;
  align: 'left' | 'center' | 'right';
}

export interface TimelineClip {
  id: string;
  trackId: string;
  assetId: string | null;
  name: string;
  kind: TrackType;
  startTime: number;
  duration: number;
  trimIn: number;
  trimOut: number;
  sourceDuration: number;
  speed: number;
  volume: number;
  muted: boolean;
  locked: boolean;
  colorTag: string;
  transform: ClipTransform;
  colorGrade: ColorGradeParams;
  chromaKey: ChromaKeyParams;
  gpuFx: GpuFxParams;
  keyframes: Record<string, Keyframe<number>[]>;
  transitions: ClipTransition[];
  effects: ClipEffect[];
  textData?: TextClipData;
}

export interface TimelineTrack {
  id: string;
  name: string;
  type: TrackType;
  index: number;
  height: number;
  muted: boolean;
  solo: boolean;
  locked: boolean;
  visible: boolean;
  volume: number;
  pan: number;
  eqLow: number;
  eqMid: number;
  eqHigh: number;
  compressorEnabled: boolean;
}

export type ToolMode = 'select' | 'razor';

export type ProxyQuality = '0.25' | '0.5' | '1';

export type AspectRatioPreset = '16:9' | '9:16' | '1:1' | '21:9';

export interface AspectResolution {
  label: string;
  width: number;
  height: number;
}

export const ASPECT_RESOLUTIONS: Record<AspectRatioPreset, AspectResolution> = {
  '16:9': { label: '16:9 Broadcast HD', width: 1920, height: 1080 },
  '9:16': { label: '9:16 Reels / Shorts', width: 1080, height: 1920 },
  '1:1': { label: '1:1 Square', width: 1080, height: 1080 },
  '21:9': { label: '21:9 Cinema Scope', width: 2560, height: 1080 },
};

export interface ProjectSnapshot {
  tracks: TimelineTrack[];
  clips: TimelineClip[];
  beatMarkers: BeatMarker[];
  captions: CaptionSegment[];
}

export interface SerializedProject {
  id: string;
  name: string;
  fps: number;
  aspectRatio: AspectRatioPreset;
  proxyQuality: ProxyQuality;
  updatedAt: number;
  assets: MediaAsset[];
  snapshot: ProjectSnapshot;
}

export interface TelemetryStats {
  fps: number;
  frameTimeMs: number;
  renderWidth: number;
  renderHeight: number;
  heapUsedMb: number | null;
  heapLimitMb: number | null;
  rendererBackend: 'WebGL2' | 'Canvas2D';
}
