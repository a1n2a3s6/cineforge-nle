import React from 'react';
import { MediaAsset, TimelineClip, ToolMode } from '../../types/timeline';
import { formatShortTime } from '../../utils/timecode';

interface TimelineClipItemProps {
  clip: TimelineClip;
  asset?: MediaAsset;
  zoom: number;
  selected: boolean;
  locked: boolean;
  activeTool: ToolMode;
  onSelect: (clipId: string, additive: boolean) => void;
  onStartDrag: (clip: TimelineClip, e: React.MouseEvent) => void;
  onStartTrim: (clip: TimelineClip, edge: 'left' | 'right', e: React.MouseEvent) => void;
  onRazorSplit: (clip: TimelineClip, e: React.MouseEvent) => void;
}

export const TimelineClipItem: React.FC<TimelineClipItemProps> = ({
  clip,
  asset,
  zoom,
  selected,
  locked,
  activeTool,
  onSelect,
  onStartDrag,
  onStartTrim,
  onRazorSplit,
}) => {
  const left = clip.startTime * zoom;
  const width = Math.max(12, clip.duration * zoom);

  const bgClasses =
    clip.kind === 'audio'
      ? 'bg-emerald-950/80 border-emerald-500/60'
      : clip.kind === 'text'
        ? 'bg-amber-950/80 border-amber-500/70'
        : 'bg-cyan-950/80 border-cyan-500/60';

  const keyframeTimes = Array.from(
    new Set(
      Object.values(clip.keyframes)
        .flat()
        .map((k) => Number(k.time.toFixed(2)))
    )
  );

  const inTransition = clip.transitions.find((t) => t.edge === 'in');
  const outTransition = clip.transitions.find((t) => t.edge === 'out');

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (locked) return;
    if (activeTool === 'razor') {
      onRazorSplit(clip, e);
      return;
    }
    onSelect(clip.id, e.shiftKey || e.ctrlKey || e.metaKey);
    onStartDrag(clip, e);
  };

  return (
    <div
      onMouseDown={handleMouseDown}
      style={{ left, width }}
      className={`absolute top-1 bottom-1 rounded border overflow-hidden select-none transition-shadow ${bgClasses} ${
        selected ? 'ring-2 ring-amber-400 z-10' : 'z-0'
      } ${
        locked
          ? 'opacity-50 cursor-not-allowed'
          : activeTool === 'razor'
            ? 'cursor-crosshair'
            : 'cursor-grab active:cursor-grabbing'
      }`}
    >
      {clip.kind === 'audio' && asset?.waveformPeaks && (
        <div className="absolute inset-0 flex items-center gap-[1px] px-0.5 opacity-50 pointer-events-none">
          {asset.waveformPeaks.map((peak, idx) => (
            <div
              key={idx}
              style={{ height: `${Math.max(10, Math.round(peak * 92))}%` }}
              className="flex-1 bg-emerald-400 rounded-sm"
            />
          ))}
        </div>
      )}

      {inTransition && (
        <div
          style={{ width: Math.min(width * 0.45, inTransition.duration * zoom) }}
          className="absolute left-0 top-0 bottom-0 bg-amber-400/25 border-r border-amber-400/60 pointer-events-none"
        />
      )}
      {outTransition && (
        <div
          style={{ width: Math.min(width * 0.45, outTransition.duration * zoom) }}
          className="absolute right-0 top-0 bottom-0 bg-amber-400/25 border-l border-amber-400/60 pointer-events-none"
        />
      )}

      <div className="relative z-10 px-2 py-0.5 flex items-center justify-between gap-1 pointer-events-none">
        <span className="text-[10px] font-medium text-zinc-100 truncate drop-shadow">
          {clip.name}
        </span>
        <span className="text-[9px] font-mono text-zinc-300/80 shrink-0">
          {formatShortTime(clip.duration)}
        </span>
      </div>

      {keyframeTimes.map((t) => (
        <div
          key={t}
          title={`Keyframe @ ${t}s`}
          style={{ left: t * zoom }}
          className="absolute bottom-1.5 w-2 h-2 -translate-x-1/2 rotate-45 bg-amber-400 border border-black z-20 pointer-events-none"
        />
      ))}

      {!locked && activeTool === 'select' && (
        <>
          <div
            onMouseDown={(e) => {
              e.stopPropagation();
              onStartTrim(clip, 'left', e);
            }}
            className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-amber-400/70 z-20"
          />
          <div
            onMouseDown={(e) => {
              e.stopPropagation();
              onStartTrim(clip, 'right', e);
            }}
            className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-amber-400/70 z-20"
          />
        </>
      )}
    </div>
  );
};
