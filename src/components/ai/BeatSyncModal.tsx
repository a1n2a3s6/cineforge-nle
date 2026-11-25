import React, { useState } from 'react';
import { Activity, X, Zap } from 'lucide-react';
import { detectBeatsFromBuffer } from '../../engine/ai/beatDetector';
import { decodeMediaAudioBuffer } from '../../engine/ai/silenceDetector';
import { useProjectStore } from '../../store/projectStore';

interface BeatSyncModalProps {
  onClose: () => void;
}

export const BeatSyncModal: React.FC<BeatSyncModalProps> = ({ onClose }) => {
  const clips = useProjectStore((s) => s.clips);
  const assets = useProjectStore((s) => s.assets);
  const setBeatMarkers = useProjectStore((s) => s.setBeatMarkers);
  const autoCutVideoToBeats = useProjectStore((s) => s.autoCutVideoToBeats);

  const audioClips = clips.filter((c) => c.kind === 'audio' && c.assetId);
  const [targetClipId, setTargetClipId] = useState(audioClips[0]?.id ?? '');
  const [sensitivity, setSensitivity] = useState(1.35);
  const [detectedBpm, setDetectedBpm] = useState<number | null>(null);
  const [beatCount, setBeatCount] = useState(0);
  const [busy, setBusy] = useState(false);

  const runDetection = async () => {
    const clip = clips.find((c) => c.id === targetClipId);
    const asset = clip?.assetId ? assets.find((a) => a.id === clip.assetId) : undefined;
    if (!clip || !asset?.url) return;

    setBusy(true);
    try {
      const buffer = await decodeMediaAudioBuffer(asset.url);
      const res = detectBeatsFromBuffer(buffer, clip.startTime, sensitivity);
      setDetectedBpm(res.bpm);
      setBeatCount(res.beats.length);
      setBeatMarkers(res.beats);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#111318] border border-[#222631] rounded-md shadow-2xl overflow-hidden">
        <div className="h-10 px-4 bg-[#0E1015] border-b border-[#222631] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-200">
              Offline AI Beat-Sync Detector
            </span>
          </div>
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {audioClips.length === 0 ? (
            <p className="text-xs text-zinc-400">Add a music clip to an Audio track first.</p>
          ) : (
            <>
              <label className="block space-y-1">
                <span className="text-[10px] font-mono uppercase text-zinc-400">Music Track</span>
                <select
                  value={targetClipId}
                  onChange={(e) => setTargetClipId(e.target.value)}
                  className="w-full bg-[#0A0B0E] border border-[#222631] rounded px-2.5 py-1.5 text-xs text-zinc-200 outline-none"
                >
                  {audioClips.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1">
                <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                  <span>TRANSIENT SENSITIVITY</span>
                  <span className="text-amber-300">{sensitivity.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min={1.05}
                  max={2.2}
                  step={0.05}
                  value={sensitivity}
                  onChange={(e) => setSensitivity(Number(e.target.value))}
                  className="nle-slider w-full"
                />
              </label>

              {detectedBpm !== null && (
                <div className="bg-[#0A0B0E] border border-amber-500/30 rounded p-3 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-mono text-zinc-400 uppercase">
                      Detected Tempo
                    </div>
                    <div className="text-xl font-mono font-bold text-amber-400">
                      {detectedBpm} BPM
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-mono text-zinc-400 uppercase">
                      Markers Placed
                    </div>
                    <div className="text-sm font-mono font-bold text-cyan-400">
                      {beatCount} beats
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#222631]">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void runDetection()}
                  className="flex-1 py-1.5 rounded bg-[#171A21] hover:bg-[#222631] border border-[#222631] text-xs font-semibold text-cyan-300"
                >
                  {busy ? 'Analyzing Spectrum...' : 'Detect Beats & Drop Markers'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    autoCutVideoToBeats();
                    onClose();
                  }}
                  className="flex-1 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold flex items-center justify-center gap-1"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Auto-Cut Video to Beat</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
