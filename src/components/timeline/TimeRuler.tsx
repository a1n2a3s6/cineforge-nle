import React, { useMemo } from 'react';
import { BeatMarker } from '../../types/ai';
import { formatTimecode } from '../../utils/timecode';

interface TimeRulerProps {
  duration: number;
  zoom: number;
  fps: number;
  beatMarkers: BeatMarker[];
  onScrubStart: (time: number, clientX: number) => void;
}

export const TimeRuler: React.FC<TimeRulerProps> = ({
  duration,
  zoom,
  fps,
  beatMarkers,
  onScrubStart,
}) => {
  const totalWidth = Math.max(900, Math.ceil(duration * zoom));

  const majorStep = useMemo(() => {
    if (zoom >= 130) return 1;
    if (zoom >= 60) return 2;
    if (zoom >= 32) return 5;
    return 10;
  }, [zoom]);

  const ticks = useMemo(() => {
    const minorStep = majorStep / 5;
    const list: { time: number; major: boolean }[] = [];
    for (let t = 0; t <= duration; t += minorStep) {
      const rounded = Math.round(t * 100) / 100;
      const isMajor = Math.abs(rounded % majorStep) < 0.01;
      list.push({ time: rounded, major: isMajor });
    }
    return list;
  }, [duration, majorStep]);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, e.clientX - rect.left);
    onScrubStart(x / zoom, e.clientX);
  };

  return (
    <div
      onMouseDown={handleMouseDown}
      style={{ width: totalWidth }}
      className="h-7 bg-[#0E1015] border-b border-[#222631] relative cursor-ew-resize select-none shrink-0"
    >
      {ticks.map((tick) => {
        const left = tick.time * zoom;
        return (
          <div key={tick.time} style={{ left }} className="absolute bottom-0 pointer-events-none">
            <div className={`w-px ${tick.major ? 'h-3.5 bg-zinc-500' : 'h-1.5 bg-zinc-700'}`} />
            {tick.major && (
              <span className="absolute -top-3.5 left-1 text-[9px] font-mono text-zinc-400 whitespace-nowrap">
                {formatTimecode(tick.time, fps)}
              </span>
            )}
          </div>
        );
      })}

      {beatMarkers.map((beat) => (
        <div
          key={beat.id}
          title={beat.label ?? `Beat ${beat.time.toFixed(2)}s`}
          style={{ left: beat.time * zoom, backgroundColor: beat.color }}
          className={`absolute bottom-0 w-1.5 h-1.5 -translate-x-1/2 rotate-45 pointer-events-none ${
            beat.isDownbeat ? 'opacity-100' : 'opacity-55'
          }`}
        />
      ))}
    </div>
  );
};
