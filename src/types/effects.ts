export type EasingType = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'spring' | 'hold';

export type AnimatableProperty = 'x' | 'y' | 'scaleX' | 'scaleY' | 'rotation' | 'opacity';

export interface Keyframe<T = number> {
  id: string;
  time: number;
  value: T;
  easing: EasingType;
}

export interface ClipTransform {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  opacity: number;
  anchorX: number;
  anchorY: number;
}

export type CinemaLutId =
  | 'rec709'
  | 'teal-orange'
  | 'kodak-2383'
  | 'noir-bw'
  | 'cyber-neon'
  | 'warm-vintage';

export interface ColorGradeParams {
  exposure: number;
  contrast: number;
  saturation: number;
  temperature: number;
  tint: number;
  highlights: number;
  shadows: number;
  vignette: number;
  sharpen: number;
  lutId: CinemaLutId;
}

export interface ChromaKeyParams {
  enabled: boolean;
  keyColor: string;
  similarity: number;
  smoothness: number;
  spill: number;
}

export interface GpuFxParams {
  blur: number;
  chromaticAberration: number;
  vhsGlitch: number;
  filmGrain: number;
}

export type TransitionType =
  | 'cross-dissolve'
  | 'dip-to-black'
  | 'whip-pan'
  | 'zoom-blur'
  | 'glitch-cut'
  | 'audio-constant-power';

export interface ClipTransition {
  id: string;
  type: TransitionType;
  duration: number;
  edge: 'in' | 'out';
}

export type EffectType =
  | 'color-grade'
  | 'gaussian-blur'
  | 'sharpen'
  | 'chromatic-aberration'
  | 'film-grain'
  | 'chroma-key'
  | 'audio-eq'
  | 'audio-compressor';

export interface ClipEffect {
  id: string;
  type: EffectType;
  name: string;
  enabled: boolean;
  params: Record<string, number | string | boolean>;
  keyframes: Record<string, Keyframe<number>[]>;
}

export const CINEMA_LUT_PRESETS: { id: CinemaLutId; label: string; shaderIndex: number }[] = [
  { id: 'rec709', label: 'Clean Rec.709', shaderIndex: 0 },
  { id: 'teal-orange', label: 'Teal & Orange', shaderIndex: 1 },
  { id: 'kodak-2383', label: 'Kodak 2383', shaderIndex: 2 },
  { id: 'noir-bw', label: 'Noir B&W', shaderIndex: 3 },
  { id: 'cyber-neon', label: 'Cyber Neon', shaderIndex: 4 },
  { id: 'warm-vintage', label: 'Warm Vintage', shaderIndex: 5 },
];

export const DEFAULT_TRANSFORM: ClipTransform = {
  x: 0,
  y: 0,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
  opacity: 1,
  anchorX: 0.5,
  anchorY: 0.5,
};

export const DEFAULT_COLOR_GRADE: ColorGradeParams = {
  exposure: 0,
  contrast: 1,
  saturation: 1,
  temperature: 0,
  tint: 0,
  highlights: 0,
  shadows: 0,
  vignette: 0,
  sharpen: 0,
  lutId: 'rec709',
};

export const DEFAULT_CHROMA_KEY: ChromaKeyParams = {
  enabled: false,
  keyColor: '#00FF00',
  similarity: 0.28,
  smoothness: 0.12,
  spill: 0.45,
};

export const DEFAULT_GPU_FX: GpuFxParams = {
  blur: 0,
  chromaticAberration: 0,
  vhsGlitch: 0,
  filmGrain: 0,
};
