import {
  CaptionPresetId,
  CaptionSegment,
  CaptionStyle,
  CaptionWord,
} from '../../types/ai';
import { uid } from '../../utils/timecode';

export const VIRAL_CAPTION_PRESETS: Record<
  CaptionPresetId,
  { label: string; style: Omit<CaptionStyle, 'rtl'> }
> = {
  'hormozi-pop': {
    label: 'Hormozi Bold Pop',
    style: {
      presetId: 'hormozi-pop',
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: 52,
      fontWeight: 900,
      color: '#FFFFFF',
      highlightColor: '#F59E0B',
      backgroundColor: 'rgba(10, 11, 14, 0.0)',
      strokeColor: '#0A0B0E',
      strokeWidth: 7,
      yPosition: 0.78,
      uppercase: true,
    },
  },
  'minimal-broadcast': {
    label: 'Minimal Broadcast',
    style: {
      presetId: 'minimal-broadcast',
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: 36,
      fontWeight: 600,
      color: '#F4F4F5',
      highlightColor: '#06B6D4',
      backgroundColor: 'rgba(10, 11, 14, 0.82)',
      strokeColor: '#000000',
      strokeWidth: 0,
      yPosition: 0.86,
      uppercase: false,
    },
  },
  'neon-glow': {
    label: 'Neon Glow',
    style: {
      presetId: 'neon-glow',
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: 46,
      fontWeight: 800,
      color: '#E0F2FE',
      highlightColor: '#10B981',
      backgroundColor: 'rgba(10, 11, 14, 0.35)',
      strokeColor: '#06B6D4',
      strokeWidth: 3,
      yPosition: 0.8,
      uppercase: true,
    },
  },
  'box-highlight': {
    label: 'Box Highlight',
    style: {
      presetId: 'box-highlight',
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: 44,
      fontWeight: 800,
      color: '#FFFFFF',
      highlightColor: '#F59E0B',
      backgroundColor: 'rgba(10, 11, 14, 0.88)',
      strokeColor: '#0A0B0E',
      strokeWidth: 2,
      yPosition: 0.82,
      uppercase: true,
    },
  },
};

export function detectArabicRtl(text: string): boolean {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(text);
}

export function buildCaptionSegment(
  text: string,
  startTime: number,
  endTime: number,
  presetId: CaptionPresetId = 'hormozi-pop',
  trackId = 'track_t1'
): CaptionSegment {
  const clean = text.trim();
  const rtl = detectArabicRtl(clean);
  const rawWords = clean.split(/\s+/).filter(Boolean);
  const totalDur = Math.max(0.4, endTime - startTime);
  const step = totalDur / Math.max(1, rawWords.length);

  const words: CaptionWord[] = rawWords.map((w, idx) => ({
    word: w,
    start: Number((startTime + idx * step).toFixed(3)),
    end: Number((startTime + (idx + 1) * step).toFixed(3)),
    confidence: 0.98,
  }));

  const preset = VIRAL_CAPTION_PRESETS[presetId].style;
  return {
    id: uid('cap'),
    trackId,
    startTime,
    endTime: startTime + totalDur,
    text: clean,
    words,
    style: {
      ...preset,
      rtl,
      uppercase: rtl ? false : preset.uppercase,
    },
  };
}

function parseSrtTimestamp(ts: string): number {
  const clean = ts.trim().replace(',', '.');
  const parts = clean.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

export function parseSrtOrVtt(
  rawText: string,
  presetId: CaptionPresetId = 'hormozi-pop'
): CaptionSegment[] {
  const normalized = rawText.replace(/\r\n/g, '\n').replace(/^WEBVTT\s*\n+/i, '');
  const blocks = normalized.split(/\n{2,}/);
  const segments: CaptionSegment[] = [];

  for (const block of blocks) {
    const lines = block
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) continue;

    const timeLineIdx = lines.findIndex((l) => l.includes('-->'));
    if (timeLineIdx === -1) continue;

    const [startStr, endStr] = lines[timeLineIdx].split('-->');
    const start = parseSrtTimestamp(startStr);
    const end = parseSrtTimestamp(endStr.split(' ')[0]);
    const text = lines.slice(timeLineIdx + 1).join(' ');
    if (!text) continue;

    segments.push(buildCaptionSegment(text, start, Math.max(start + 0.5, end), presetId));
  }

  return segments;
}

function formatSrtTime(sec: number): string {
  const safe = Math.max(0, sec);
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = Math.floor(safe % 60);
  const ms = Math.floor((safe % 1) * 1000);
  const pad = (n: number, d = 2) => n.toString().padStart(d, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}

export function exportCaptionsToSrt(captions: CaptionSegment[]): string {
  return [...captions]
    .sort((a, b) => a.startTime - b.startTime)
    .map(
      (cap, idx) =>
        `${idx + 1}\n${formatSrtTime(cap.startTime)} --> ${formatSrtTime(cap.endTime)}\n${cap.text}`
    )
    .join('\n\n');
}

export function renderKaraokeCaption(
  ctx: CanvasRenderingContext2D,
  cap: CaptionSegment,
  currentTime: number,
  width: number,
  height: number
): void {
  const scaleFactor = height / 1080;
  const fontSize = Math.max(12, Math.round(cap.style.fontSize * scaleFactor));
  const y = height * cap.style.yPosition;

  ctx.save();
  ctx.font = `${cap.style.fontWeight} ${fontSize}px ${cap.style.fontFamily}`;
  ctx.textBaseline = 'middle';
  ctx.direction = cap.style.rtl ? 'rtl' : 'ltr';

  const displayWords = cap.words.map((w) => ({
    ...w,
    label: cap.style.uppercase && !cap.style.rtl ? w.word.toUpperCase() : w.word,
    active: currentTime >= w.start && currentTime <= w.end,
  }));

  const spaceW = ctx.measureText(' ').width * 1.15;
  const wordWidths = displayWords.map((w) => ctx.measureText(w.label).width);
  const totalWidth =
    wordWidths.reduce((acc, w) => acc + w, 0) + spaceW * Math.max(0, displayWords.length - 1);

  if (cap.style.backgroundColor && !cap.style.backgroundColor.endsWith('0.0)')) {
    const padX = fontSize * 0.5;
    const padY = fontSize * 0.35;
    ctx.fillStyle = cap.style.backgroundColor;
    ctx.fillRect(
      width / 2 - totalWidth / 2 - padX,
      y - fontSize / 2 - padY,
      totalWidth + padX * 2,
      fontSize + padY * 2
    );
  }

  let cursorX = cap.style.rtl ? width / 2 + totalWidth / 2 : width / 2 - totalWidth / 2;

  displayWords.forEach((w, idx) => {
    const wWidth = wordWidths[idx];
    const centerX = cap.style.rtl ? cursorX - wWidth / 2 : cursorX + wWidth / 2;

    ctx.save();
    ctx.translate(centerX, y);

    if (w.active && cap.style.presetId === 'hormozi-pop') {
      ctx.scale(1.14, 1.14);
    }

    if (w.active && cap.style.presetId === 'box-highlight') {
      ctx.fillStyle = cap.style.highlightColor;
      ctx.fillRect(-wWidth / 2 - 6, -fontSize / 2 - 4, wWidth + 12, fontSize + 8);
    }

    if (cap.style.presetId === 'neon-glow') {
      ctx.shadowColor = w.active ? cap.style.highlightColor : cap.style.strokeColor;
      ctx.shadowBlur = w.active ? 18 : 8;
    }

    ctx.textAlign = 'center';
    if (cap.style.strokeWidth > 0) {
      ctx.lineWidth = Math.max(1, cap.style.strokeWidth * scaleFactor);
      ctx.strokeStyle = cap.style.strokeColor;
      ctx.lineJoin = 'round';
      ctx.strokeText(w.label, 0, 0);
    }

    ctx.fillStyle =
      w.active && cap.style.presetId === 'box-highlight'
        ? '#0A0B0E'
        : w.active
          ? cap.style.highlightColor
          : cap.style.color;
    ctx.fillText(w.label, 0, 0);
    ctx.restore();

    cursorX = cap.style.rtl ? cursorX - wWidth - spaceW : cursorX + wWidth + spaceW;
  });

  ctx.restore();
}
