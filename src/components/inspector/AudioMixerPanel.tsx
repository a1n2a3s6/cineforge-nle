import React, { useEffect, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { audioMixer } from '../../engine/audio/AudioMixer';
import { useProjectStore } from '../../store/projectStore';

function dbToPercent(db: number): number {
  return Math.max(0, Math.min(100, ((db + 60) / 60) * 100));
}

export const AudioMixerPanel: React.FC = () => {
  const tracks = useProjectStore((s) => s.tracks);
  const toggleTrackFlag = useProjectStore((s) => s.toggleTrackFlag);
  const updateTrackAudio = useProjectStore((s) => s.updateTrackAudio);

  const audioTracks = tracks.filter((t) => t.type === 'audio');
  const [levels, setLevels] = useState<Record<string, number>>({});
  const [masterDb, setMasterDb] = useState(-60);

  useEffect(() => {
    let raf = 0;
    let lastTick = 0;

    const pollMeters = (now: number) => {
      if (now - lastTick >= 50) {
        lastTick = now;
        const next: Record<string, number> = {};
        audioTracks.forEach((t) => {
          next[t.id] = audioMixer.getTrackLevelDb(t.id);
        });
        setLevels(next);
        setMasterDb(audioMixer.getMasterLevelDb());
      }
      raf = requestAnimationFrame(pollMeters);
    };

    raf = requestAnimationFrame(pollMeters);
    return () => cancelAnimationFrame(raf);
  }, [audioTracks]);

  return (
    <div className="space-y-3">
      <div className="bg-[#0A0B0E] border border-[#222631] rounded p-2.5">
        <div className="flex items-center justify-between text-[10px] font-mono mb-1.5">
          <span className="text-zinc-300 font-semibold uppercase">Master Bus</span>
          <span className={masterDb > -3 ? 'text-red-400' : 'text-emerald-400'}>
            {masterDb <= -59 ? '-∞ dB' : `${masterDb.toFixed(1)} dB`}
          </span>
        </div>
        <div className="h-2.5 bg-[#171A21] rounded overflow-hidden border border-[#222631]">
          <div
            style={{ width: `${dbToPercent(masterDb)}%` }}
            className="h-full transition-[width] duration-75 bg-gradient-to-r from-emerald-500 via-amber-400 to-red-500"
          />
        </div>
      </div>

      {audioTracks.map((track) => {
        const db = levels[track.id] ?? -60;
        const pct = dbToPercent(db);
        return (
          <div
            key={track.id}
            className="bg-[#0D0F14] border border-[#222631] rounded p-2.5 space-y-2.5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-emerald-400">{track.name}</span>
                <span className="text-[10px] font-mono text-zinc-500">
                  {db <= -59 ? '-∞ dB' : `${db.toFixed(1)} dB`}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => toggleTrackFlag(track.id, 'muted')}
                  className={`p-1 rounded ${
                    track.muted ? 'bg-red-500/20 text-red-400' : 'text-zinc-400 hover:bg-[#222631]'
                  }`}
                  title="Mute"
                >
                  {track.muted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                </button>
                <button
                  type="button"
                  onClick={() => toggleTrackFlag(track.id, 'solo')}
                  className={`w-5 h-5 rounded text-[10px] font-mono font-bold ${
                    track.solo ? 'bg-amber-500 text-black' : 'text-zinc-400 hover:bg-[#222631]'
                  }`}
                  title="Solo"
                >
                  S
                </button>
                <button
                  type="button"
                  onClick={() => toggleTrackFlag(track.id, 'compressorEnabled')}
                  className={`px-1.5 h-5 rounded text-[9px] font-mono font-bold ${
                    track.compressorEnabled
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'text-zinc-500 border border-[#222631]'
                  }`}
                  title="Dynamics Compressor"
                >
                  COMP
                </button>
              </div>
            </div>

            <div className="h-2 bg-[#171A21] rounded overflow-hidden border border-[#222631]">
              <div
                style={{ width: `${pct}%` }}
                className="h-full transition-[width] duration-75 bg-gradient-to-r from-emerald-500 via-amber-400 to-red-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1">
                <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                  <span>GAIN</span>
                  <span>{Math.round(track.volume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1.5}
                  step={0.01}
                  value={track.volume}
                  onChange={(e) => updateTrackAudio(track.id, { volume: Number(e.target.value) })}
                  className="nle-slider w-full"
                />
              </label>

              <label className="space-y-1">
                <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                  <span>PAN</span>
                  <span>
                    {track.pan === 0
                      ? 'C'
                      : track.pan < 0
                        ? `L${Math.round(Math.abs(track.pan) * 100)}`
                        : `R${Math.round(track.pan * 100)}`}
                  </span>
                </div>
                <input
                  type="range"
                  min={-1}
                  max={1}
                  step={0.05}
                  value={track.pan}
                  onChange={(e) => updateTrackAudio(track.id, { pan: Number(e.target.value) })}
                  className="nle-slider w-full"
                />
              </label>
            </div>

            <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-[#1D202A]">
              {(
                [
                  ['eqLow', 'LOW'],
                  ['eqMid', 'MID'],
                  ['eqHigh', 'HIGH'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="space-y-1">
                  <div className="flex justify-between text-[9px] font-mono text-zinc-400">
                    <span>{label}</span>
                    <span>{track[key] > 0 ? `+${track[key]}` : track[key]}dB</span>
                  </div>
                  <input
                    type="range"
                    min={-12}
                    max={12}
                    step={0.5}
                    value={track[key]}
                    onChange={(e) => updateTrackAudio(track.id, { [key]: Number(e.target.value) })}
                    className="nle-slider w-full"
                  />
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};
