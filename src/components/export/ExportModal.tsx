import React, { useRef, useState } from 'react';
import { Download, Film, X } from 'lucide-react';
import {
  ExportProgress,
  ExportResolutionPreset,
  renderTimelineLocally,
} from '../../engine/export/RenderPipeline';
import { useProjectStore } from '../../store/projectStore';

interface ExportModalProps {
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({ onClose }) => {
  const projectName = useProjectStore((s) => s.projectName);
  const tracks = useProjectStore((s) => s.tracks);
  const clips = useProjectStore((s) => s.clips);
  const assets = useProjectStore((s) => s.assets);
  const captions = useProjectStore((s) => s.captions);

  const [resolution, setResolution] = useState<ExportResolutionPreset>('1080p');
  const [fps, setFps] = useState<30 | 60>(60);
  const [bitrateMbps, setBitrateMbps] = useState(12);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const handleStartExport = async () => {
    setExporting(true);
    setError(null);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const blob = await renderTimelineLocally(
        {
          tracks,
          clips,
          assets,
          captions,
          config: {
            resolution,
            fps,
            bitrateMbps,
            fileName: projectName.replace(/\s+/g, '_'),
          },
        },
        (p) => setProgress(p),
        controller.signal
      );

      const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectName.replace(/\s+/g, '_')}_${resolution}_${fps}fps.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#111318] border border-[#222631] rounded-md shadow-2xl overflow-hidden">
        <div className="h-10 px-4 bg-[#0E1015] border-b border-[#222631] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Film className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-200">
              Local 60fps Master Export (Zero Watermark)
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              abortRef.current?.abort();
              onClose();
            }}
            className="text-zinc-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-3 gap-1.5">
            {(
              [
                ['1080p', '1080p HD'],
                ['4k', '4K UHD'],
                ['reels-9-16', '9:16 Reels'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                disabled={exporting}
                onClick={() => setResolution(id)}
                className={`py-2 rounded text-xs font-mono font-semibold border ${
                  resolution === id
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                    : 'bg-[#0A0B0E] border-[#222631] text-zinc-400'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-[10px] font-mono uppercase text-zinc-400">Frame Rate</span>
              <select
                disabled={exporting}
                value={fps}
                onChange={(e) => setFps(Number(e.target.value) as 30 | 60)}
                className="w-full bg-[#0A0B0E] border border-[#222631] rounded px-2 py-1.5 text-xs text-zinc-200"
              >
                <option value={60}>60 fps (Broadcast Smooth)</option>
                <option value={30}>30 fps (Low-CPU)</option>
              </select>
            </label>

            <label className="space-y-1">
              <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                <span>BITRATE</span>
                <span className="text-amber-300">{bitrateMbps} Mbps</span>
              </div>
              <input
                type="range"
                disabled={exporting}
                min={4}
                max={30}
                value={bitrateMbps}
                onChange={(e) => setBitrateMbps(Number(e.target.value))}
                className="nle-slider w-full mt-2"
              />
            </label>
          </div>

          {progress && (
            <div className="bg-[#0A0B0E] border border-[#222631] rounded p-3 space-y-2">
              <div className="flex justify-between text-[11px] font-mono">
                <span className="text-cyan-300">{progress.status}</span>
                <span className="text-amber-400 font-bold">{progress.percent}%</span>
              </div>
              <div className="h-2 bg-[#171A21] rounded overflow-hidden">
                <div
                  style={{ width: `${progress.percent}%` }}
                  className="h-full bg-emerald-500 transition-[width] duration-100"
                />
              </div>
              <div className="flex justify-between text-[10px] font-mono text-zinc-500">
                <span>
                  {progress.currentTime.toFixed(1)}s / {progress.totalDuration.toFixed(1)}s
                </span>
                <span>ETA: ~{progress.etaSeconds}s</span>
              </div>
            </div>
          )}

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex justify-end gap-2 pt-2 border-t border-[#222631]">
            {exporting ? (
              <button
                type="button"
                onClick={() => abortRef.current?.abort()}
                className="px-4 py-1.5 rounded bg-red-500/20 border border-red-500/40 text-red-300 text-xs font-semibold"
              >
                Cancel Render
              </button>
            ) : (
              <button
                type="button"
                disabled={clips.length === 0}
                onClick={() => void handleStartExport()}
                className="px-4 py-1.5 rounded bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-black text-xs font-bold flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Render & Download Local Video</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
