import React, { useEffect, useState } from 'react';
import { Scissors, X, Zap } from 'lucide-react';
import {
  decodeMediaAudioBuffer,
  detectSilencesFromBuffer,
  SilenceAnalysisResult,
} from '../../engine/ai/silenceDetector';
import { useProjectStore } from '../../store/projectStore';

interface AutoSilenceModalProps {
  onClose: () => void;
}

export const AutoSilenceModal: React.FC<AutoSilenceModalProps> = ({ onClose }) => {
  const clips = useProjectStore((s) => s.clips);
  const assets = useProjectStore((s) => s.assets);
  const selectedClipIds = useProjectStore((s) => s.selectedClipIds);
  const applySilenceCuts = useProjectStore((s) => s.applySilenceCuts);

  const audioCapableClips = clips.filter((c) => {
    if (!c.assetId) return false;
    const asset = assets.find((a) => a.id === c.assetId);
    return asset && (asset.kind === 'audio' || asset.kind === 'video') && Boolean(asset.url);
  });

  const [targetClipId, setTargetClipId] = useState<string>(
    audioCapableClips.find((c) => selectedClipIds.includes(c.id))?.id ??
      audioCapableClips[0]?.id ??
      ''
  );
  const [thresholdDb, setThresholdDb] = useState(-34);
  const [minSilenceMs, setMinSilenceMs] = useState(350);
  const [paddingMs, setPaddingMs] = useState(80);
  const [decodedBuffer, setDecodedBuffer] = useState<AudioBuffer | null>(null);
  const [analysis, setAnalysis] = useState<SilenceAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const clip = clips.find((c) => c.id === targetClipId);
    const asset = clip?.assetId ? assets.find((a) => a.id === clip.assetId) : undefined;
    if (!asset?.url) {
      setDecodedBuffer(null);
      setAnalysis(null);
      return;
    }

    let cancelled = false;
    setError(null);
    decodeMediaAudioBuffer(asset.url)
      .then((buf) => {
        if (!cancelled) setDecodedBuffer(buf);
      })
      .catch(() => {
        if (!cancelled) setError('Could not decode audio track for this clip.');
      });

    return () => {
      cancelled = true;
    };
  }, [targetClipId, clips, assets]);

  useEffect(() => {
    if (!decodedBuffer) return;
    setAnalysis(
      detectSilencesFromBuffer(decodedBuffer, {
        thresholdDb,
        minSilenceMs,
        paddingMs,
      })
    );
  }, [decodedBuffer, thresholdDb, minSilenceMs, paddingMs]);

  const totalDeadAir = analysis
    ? analysis.silences.reduce((acc, s) => acc + s.duration, 0)
    : 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-[#111318] border border-[#222631] rounded-md shadow-2xl overflow-hidden">
        <div className="h-10 px-4 bg-[#0E1015] border-b border-[#222631] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scissors className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-200">
              Offline AI Auto-Silence & Dead-Air Cutter
            </span>
          </div>
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {audioCapableClips.length === 0 ? (
            <p className="text-xs text-zinc-400">
              Load the Synthetic Demo or import an audio/video clip onto the timeline first.
            </p>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400 w-24">Target Clip</span>
                <select
                  value={targetClipId}
                  onChange={(e) => setTargetClipId(e.target.value)}
                  className="flex-1 bg-[#0A0B0E] border border-[#222631] rounded px-2.5 py-1.5 text-xs text-zinc-200 outline-none"
                >
                  {audioCapableClips.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.duration.toFixed(1)}s)
                    </option>
                  ))}
                </select>
              </div>

              {error && <p className="text-xs text-red-400">{error}</p>}

              <div className="h-28 bg-[#07080B] border border-[#222631] rounded relative overflow-hidden flex items-center px-1 gap-[1px]">
                {analysis?.peaks.map((p, idx) => (
                  <div
                    key={idx}
                    style={{ height: `${Math.max(8, Math.round(p * 90))}%` }}
                    className="flex-1 bg-emerald-500/75 rounded-sm"
                  />
                ))}
                {analysis?.silences.map((s, idx) => {
                  const leftPct = (s.start / Math.max(0.1, analysis.duration)) * 100;
                  const widthPct = (s.duration / Math.max(0.1, analysis.duration)) * 100;
                  return (
                    <div
                      key={idx}
                      style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                      className="absolute top-0 bottom-0 bg-red-500/35 border-x border-red-500/80"
                    />
                  );
                })}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <label className="space-y-1">
                  <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                    <span>THRESHOLD</span>
                    <span className="text-amber-300">{thresholdDb} dB</span>
                  </div>
                  <input
                    type="range"
                    min={-60}
                    max={-10}
                    value={thresholdDb}
                    onChange={(e) => setThresholdDb(Number(e.target.value))}
                    className="nle-slider w-full"
                  />
                </label>

                <label className="space-y-1">
                  <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                    <span>MIN SILENCE</span>
                    <span className="text-cyan-300">{minSilenceMs} ms</span>
                  </div>
                  <input
                    type="range"
                    min={100}
                    max={1500}
                    step={25}
                    value={minSilenceMs}
                    onChange={(e) => setMinSilenceMs(Number(e.target.value))}
                    className="nle-slider w-full"
                  />
                </label>

                <label className="space-y-1">
                  <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                    <span>PADDING</span>
                    <span className="text-emerald-300">{paddingMs} ms</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={250}
                    step={10}
                    value={paddingMs}
                    onChange={(e) => setPaddingMs(Number(e.target.value))}
                    className="nle-slider w-full"
                  />
                </label>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-[#222631]">
                <span className="text-xs font-mono text-zinc-400">
                  Detected:{' '}
                  <strong className="text-red-400">{analysis?.silences.length ?? 0}</strong> gaps (
                  {totalDeadAir.toFixed(2)}s dead air)
                </span>
                <button
                  type="button"
                  disabled={!analysis || analysis.silences.length === 0}
                  onClick={() => {
                    if (analysis) applySilenceCuts(targetClipId, analysis.silences);
                    onClose();
                  }}
                  className="px-3.5 py-1.5 rounded bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black text-xs font-bold flex items-center gap-1.5"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Cut All Silences</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
