export interface BeatMarker {
  id: string;
  time: number;
  strength: number;
  label?: string;
  color: string;
  isDownbeat: boolean;
}

export interface CaptionWord {
  word: string;
  start: number;
  end: number;
  confidence: number;
}

export type CaptionPresetId =
  | 'hormozi-pop'
  | 'minimal-broadcast'
  | 'neon-glow'
  | 'box-highlight';

export interface CaptionStyle {
  presetId: CaptionPresetId;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  highlightColor: string;
  backgroundColor: string;
  strokeColor: string;
  strokeWidth: number;
  yPosition: number;
  uppercase: boolean;
  rtl: boolean;
}

export interface CaptionSegment {
  id: string;
  trackId: string;
  startTime: number;
  endTime: number;
  text: string;
  words: CaptionWord[];
  style: CaptionStyle;
}

export type AITaskStatus = 'idle' | 'queued' | 'running' | 'completed' | 'error';

export interface AITaskRecord {
  id: string;
  kind: 'auto-captions' | 'beat-detection' | 'scene-cut' | 'silence-removal';
  status: AITaskStatus;
  progress: number;
  message: string;
  createdAt: number;
}

export const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  presetId: 'hormozi-pop',
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 48,
  fontWeight: 900,
  color: '#FFFFFF',
  highlightColor: '#F59E0B',
  backgroundColor: 'rgba(10, 11, 14, 0.72)',
  strokeColor: '#0A0B0E',
  strokeWidth: 5,
  yPosition: 0.82,
  uppercase: true,
  rtl: false,
};
