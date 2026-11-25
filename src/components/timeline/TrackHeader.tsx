import React from 'react';
import { Eye, EyeOff, Lock, Trash2, Unlock, Volume2, VolumeX } from 'lucide-react';
import { useProjectStore } from '../../store/projectStore';
import { TimelineTrack } from '../../types/timeline';

interface TrackHeaderProps {
  track: TimelineTrack;
}

export const TrackHeader: React.FC<TrackHeaderProps> = ({ track }) => {
  const toggleTrackFlag = useProjectStore((s) => s.toggleTrackFlag);
  const deleteTrack = useProjectStore((s) => s.deleteTrack);

  const accentColor =
    track.type === 'video'
      ? 'text-cyan-400 border-l-cyan-500'
      : track.type === 'audio'
        ? 'text-emerald-400 border-l-emerald-500'
        : 'text-amber-400 border-l-amber-500';

  return (
    <div
      style={{ height: track.height }}
      className={`w-48 shrink-0 px-2 bg-[#111318] border-b border-r border-[#222631] border-l-2 ${accentColor} flex items-center justify-between gap-1`}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="font-mono text-xs font-bold w-7">{track.name}</span>
        <span className="text-[10px] uppercase text-zinc-500 truncate">{track.type}</span>
      </div>

      <div className="flex items-center gap-0.5">
        {track.type === 'audio' ? (
          <button
            type="button"
            title="Mute Track"
            onClick={() => toggleTrackFlag(track.id, 'muted')}
            className={`p-1 rounded text-[10px] font-mono ${
              track.muted ? 'bg-red-500/20 text-red-400' : 'text-zinc-400 hover:bg-[#222631]'
            }`}
          >
            {track.muted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
          </button>
        ) : (
          <button
            type="button"
            title="Toggle Visibility"
            onClick={() => toggleTrackFlag(track.id, 'visible')}
            className={`p-1 rounded ${
              !track.visible ? 'bg-zinc-800 text-zinc-600' : 'text-zinc-400 hover:bg-[#222631]'
            }`}
          >
            {track.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
          </button>
        )}

        <button
          type="button"
          title="Solo Track"
          onClick={() => toggleTrackFlag(track.id, 'solo')}
          className={`w-5 h-5 rounded text-[10px] font-mono font-bold flex items-center justify-center ${
            track.solo ? 'bg-amber-500 text-black' : 'text-zinc-400 hover:bg-[#222631]'
          }`}
        >
          S
        </button>

        <button
          type="button"
          title="Lock Track"
          onClick={() => toggleTrackFlag(track.id, 'locked')}
          className={`p-1 rounded ${
            track.locked ? 'bg-amber-500/20 text-amber-400' : 'text-zinc-400 hover:bg-[#222631]'
          }`}
        >
          {track.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
        </button>

        <button
          type="button"
          title="Delete Track"
          onClick={() => deleteTrack(track.id)}
          className="p-1 rounded text-zinc-600 hover:text-red-400 hover:bg-[#222631]"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};
