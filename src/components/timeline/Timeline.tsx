import React, { useMemo, useRef } from 'react';
import {
  Magnet,
  MousePointer2,
  Plus,
  Scissors,
  Trash2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useProjectStore } from '../../store/projectStore';
import { TimelineClip } from '../../types/timeline';
import { TimeRuler } from './TimeRuler';
import { TimelineClipItem } from './TimelineClipItem';
import { TrackHeader } from './TrackHeader';

const SNAP_THRESHOLD_PX = 10;

export const Timeline: React.FC = () => {
  const tracks = useProjectStore((s) => s.tracks);
  const clips = useProjectStore((s) => s.clips);
  const assets = useProjectStore((s) => s.assets);
  const beatMarkers = useProjectStore((s) => s.beatMarkers);
  const playhead = useProjectStore((s) => s.playhead);
  const fps = useProjectStore((s) => s.fps);
  const zoom = useProjectStore((s) => s.zoom);
  const snapEnabled = useProjectStore((s) => s.snapEnabled);
  const activeTool = useProjectStore((s) => s.activeTool);
  const selectedClipIds = useProjectStore((s) => s.selectedClipIds);

  const setPlayhead = useProjectStore((s) => s.setPlayhead);
  const setZoom = useProjectStore((s) => s.setZoom);
  const toggleSnap = useProjectStore((s) => s.toggleSnap);
  const setActiveTool = useProjectStore((s) => s.setActiveTool);
  const selectClip = useProjectStore((s) => s.selectClip);
  const addTrack = useProjectStore((s) => s.addTrack);
  const addAssetToTimeline = useProjectStore((s) => s.addAssetToTimeline);
  const commitSnapshot = useProjectStore((s) => s.commitSnapshot);
  const moveClip = useProjectStore((s) => s.moveClip);
  const trimClip = useProjectStore((s) => s.trimClip);
  const splitClipAtTime = useProjectStore((s) => s.splitClipAtTime);
  const deleteSelectedClips = useProjectStore((s) => s.deleteSelectedClips);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const tracksLaneRef = useRef<HTMLDivElement>(null);

  const timelineDuration = useMemo(() => {
    const maxEnd = clips.reduce((acc, c) => Math.max(acc, c.startTime + c.duration), 20);
    return Math.max(30, Math.ceil(maxEnd + 15));
  }, [clips]);

  const totalWidth = Math.max(900, Math.ceil(timelineDuration * zoom));

  const assetMap = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);

  const getSnappedTime = (candidateTime: number, excludeClipId?: string): number => {
    if (!snapEnabled) return Math.max(0, candidateTime);
    const thresholdSec = SNAP_THRESHOLD_PX / zoom;

    const snapPoints: number[] = [0, playhead];
    beatMarkers.forEach((b) => snapPoints.push(b.time));
    clips.forEach((c) => {
      if (c.id === excludeClipId) return;
      snapPoints.push(c.startTime, c.startTime + c.duration);
    });

    let closest = candidateTime;
    let bestDist = thresholdSec;
    for (const pt of snapPoints) {
      const dist = Math.abs(pt - candidateTime);
      if (dist < bestDist) {
        bestDist = dist;
        closest = pt;
      }
    }
    return Math.max(0, closest);
  };

  const handleScrubStart = (initialTime: number, startClientX: number) => {
    setPlayhead(initialTime);
    const onMove = (ev: MouseEvent) => {
      const deltaSec = (ev.clientX - startClientX) / zoom;
      setPlayhead(Math.max(0, initialTime + deltaSec));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleStartDragClip = (clip: TimelineClip, e: React.MouseEvent) => {
    const startX = e.clientX;
    const origStart = clip.startTime;
    let hasCommitted = false;

    const onMove = (ev: MouseEvent) => {
      const deltaSec = (ev.clientX - startX) / zoom;
      const rawTime = Math.max(0, origStart + deltaSec);
      const snappedStart = getSnappedTime(rawTime, clip.id);

      let targetTrackId = clip.trackId;
      if (tracksLaneRef.current) {
        const laneRect = tracksLaneRef.current.getBoundingClientRect();
        const relY = ev.clientY - laneRect.top;
        let accumY = 0;
        for (const t of tracks) {
          if (relY >= accumY && relY < accumY + t.height) {
            if (t.type === clip.kind && !t.locked) {
              targetTrackId = t.id;
            }
            break;
          }
          accumY += t.height;
        }
      }

      if (!hasCommitted) {
        commitSnapshot();
        hasCommitted = true;
      }
      moveClip(clip.id, targetTrackId, snappedStart, false);
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleStartTrim = (clip: TimelineClip, edge: 'left' | 'right', e: React.MouseEvent) => {
    const startX = e.clientX;
    const initialEdgeTime = edge === 'left' ? clip.startTime : clip.startTime + clip.duration;
    let hasCommitted = false;

    const onMove = (ev: MouseEvent) => {
      const deltaSec = (ev.clientX - startX) / zoom;
      const candidate = initialEdgeTime + deltaSec;
      const snapped = getSnappedTime(candidate, clip.id);

      if (!hasCommitted) {
        commitSnapshot();
        hasCommitted = true;
      }
      trimClip(clip.id, edge, snapped, false);
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleRazorSplit = (clip: TimelineClip, e: React.MouseEvent) => {
    if (!tracksLaneRef.current) return;
    const rect = tracksLaneRef.current.getBoundingClientRect();
    const clickTime = (e.clientX - rect.left) / zoom;
    const snappedTime = getSnappedTime(clickTime, clip.id);
    splitClipAtTime(clip.id, snappedTime);
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.15 : 0.87;
      setZoom(zoom * factor);
    }
  };

  return (
    <section className="h-64 shrink-0 bg-[#111318] border-t border-[#222631] flex flex-col">
      <div className="h-9 px-3 bg-[#14171F] border-b border-[#222631] flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            title="Select Tool (V)"
            onClick={() => setActiveTool('select')}
            className={`px-2 py-1 rounded text-xs flex items-center gap-1 font-medium transition-colors ${
              activeTool === 'select'
                ? 'bg-amber-500 text-black font-semibold'
                : 'text-zinc-300 hover:bg-[#222631]'
            }`}
          >
            <MousePointer2 className="w-3.5 h-3.5" />
            <span>Select</span>
            <kbd className="text-[9px] font-mono opacity-75">V</kbd>
          </button>

          <button
            type="button"
            title="Razor Split Tool (C)"
            onClick={() => setActiveTool('razor')}
            className={`px-2 py-1 rounded text-xs flex items-center gap-1 font-medium transition-colors ${
              activeTool === 'razor'
                ? 'bg-amber-500 text-black font-semibold'
                : 'text-zinc-300 hover:bg-[#222631]'
            }`}
          >
            <Scissors className="w-3.5 h-3.5" />
            <span>Razor</span>
            <kbd className="text-[9px] font-mono opacity-75">C</kbd>
          </button>

          <div className="w-px h-4 bg-[#222631] mx-1" />

          <button
            type="button"
            disabled={selectedClipIds.length === 0}
            title="Ripple Delete Selected (Shift+Del)"
            onClick={() => deleteSelectedClips(true)}
            className="px-2 py-1 rounded text-xs flex items-center gap-1 text-zinc-300 hover:bg-red-500/20 hover:text-red-300 disabled:opacity-35 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Ripple Del</span>
          </button>

          <button
            type="button"
            title="Toggle Magnetic Snapping"
            onClick={toggleSnap}
            className={`px-2 py-1 rounded text-xs flex items-center gap-1 transition-colors ${
              snapEnabled
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-zinc-400 hover:bg-[#222631]'
            }`}
          >
            <Magnet className="w-3.5 h-3.5" />
            <span>Snap</span>
          </button>

          <div className="w-px h-4 bg-[#222631] mx-1" />

          <button
            type="button"
            onClick={() => addTrack('video')}
            className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-[#171A21] hover:bg-[#222631] border border-[#222631] text-cyan-300 flex items-center gap-0.5"
          >
            <Plus className="w-3 h-3" /> V
          </button>
          <button
            type="button"
            onClick={() => addTrack('text')}
            className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-[#171A21] hover:bg-[#222631] border border-[#222631] text-amber-300 flex items-center gap-0.5"
          >
            <Plus className="w-3 h-3" /> T
          </button>
          <button
            type="button"
            onClick={() => addTrack('audio')}
            className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-[#171A21] hover:bg-[#222631] border border-[#222631] text-emerald-300 flex items-center gap-0.5"
          >
            <Plus className="w-3 h-3" /> A
          </button>
        </div>

        <div className="flex items-center gap-2">
          <ZoomOut className="w-3.5 h-3.5 text-zinc-400" />
          <input
            type="range"
            min={18}
            max={260}
            value={Math.round(zoom)}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="nle-slider w-28"
            title="Timeline Zoom (Ctrl+Scroll)"
          />
          <ZoomIn className="w-3.5 h-3.5 text-zinc-400" />
          <span className="text-[10px] font-mono text-zinc-400 w-10 text-right">
            {Math.round(zoom)}px
          </span>
        </div>
      </div>

      <div
        ref={scrollContainerRef}
        onWheel={handleWheel}
        className="flex-1 flex overflow-auto relative bg-[#0A0B0E]"
      >
        <div className="sticky left-0 z-30 flex flex-col shrink-0 bg-[#111318]">
          <div className="h-7 w-48 border-b border-r border-[#222631] bg-[#0E1015] px-2 flex items-center text-[10px] font-mono text-zinc-500 uppercase">
            Tracks ({tracks.length})
          </div>
          {tracks.map((track) => (
            <TrackHeader key={track.id} track={track} />
          ))}
        </div>

        <div
          style={{ width: totalWidth }}
          className="relative flex flex-col shrink-0"
          onMouseDown={() => selectClip(null)}
        >
          <TimeRuler
            duration={timelineDuration}
            zoom={zoom}
            fps={fps}
            beatMarkers={beatMarkers}
            onScrubStart={handleScrubStart}
          />

          <div ref={tracksLaneRef} className="relative flex-1">
            {tracks.map((track) => (
              <div
                key={track.id}
                style={{ height: track.height }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const assetId = e.dataTransfer.getData('application/x-cineforge-asset');
                  if (!assetId || !tracksLaneRef.current) return;
                  const rect = tracksLaneRef.current.getBoundingClientRect();
                  const dropTime = Math.max(0, (e.clientX - rect.left) / zoom);
                  addAssetToTimeline(assetId, track.id, getSnappedTime(dropTime));
                }}
                className="relative border-b border-[#1D202A] bg-[#0B0D12]"
              >
                {clips
                  .filter((c) => c.trackId === track.id)
                  .map((clip) => (
                    <TimelineClipItem
                      key={clip.id}
                      clip={clip}
                      asset={clip.assetId ? assetMap.get(clip.assetId) : undefined}
                      zoom={zoom}
                      selected={selectedClipIds.includes(clip.id)}
                      locked={track.locked || clip.locked}
                      activeTool={activeTool}
                      onSelect={selectClip}
                      onStartDrag={handleStartDragClip}
                      onStartTrim={handleStartTrim}
                      onRazorSplit={handleRazorSplit}
                    />
                  ))}
              </div>
            ))}
          </div>

          <div
            style={{ left: playhead * zoom }}
            className="absolute top-0 bottom-0 w-px bg-amber-400 pointer-events-none z-40"
          >
            <div className="w-2.5 h-3 bg-amber-400 -translate-x-1/2 rounded-b-sm shadow" />
          </div>
        </div>
      </div>
    </section>
  );
};
