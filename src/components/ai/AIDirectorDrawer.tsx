import React, { useState } from 'react';
import { Bot, Send, Sparkles, X } from 'lucide-react';
import { DirectorAction, runAIDirector } from '../../engine/ai/aiDirector';
import { useProjectStore } from '../../store/projectStore';

interface AIDirectorDrawerProps {
  open: boolean;
  onClose: () => void;
  onOpenSilence: () => void;
  onOpenBeat: () => void;
  onOpenExport: () => void;
}

interface LogEntry {
  role: 'user' | 'director';
  text: string;
}

export const AIDirectorDrawer: React.FC<AIDirectorDrawerProps> = ({
  open,
  onClose,
  onOpenSilence,
  onOpenBeat,
  onOpenExport,
}) => {
  const [provider, setProvider] = useState<'offline' | 'gemini' | 'groq'>('offline');
  const [apiKey, setApiKey] = useState('');
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      role: 'director',
      text: 'Offline Smart Director ready (zero API key required). Try: "apply teal orange lut", "zoom 1.3x", "add cross dissolve", "switch to 9:16 reels", or "cut silences".',
    },
  ]);

  if (!open) return null;

  const executeActions = (actions: DirectorAction[]) => {
    const state = useProjectStore.getState();
    const targetClipId = state.selectedClipIds[0] ?? state.clips.find((c) => c.kind === 'video')?.id;

    actions.forEach((act) => {
      switch (act.type) {
        case 'OPEN_SILENCE_MODAL':
          onOpenSilence();
          break;
        case 'OPEN_BEAT_MODAL':
          onOpenBeat();
          break;
        case 'OPEN_EXPORT_MODAL':
          onOpenExport();
          break;
        case 'SET_ASPECT_RATIO':
          state.setAspectRatio(act.ratio);
          break;
        case 'APPLY_LUT':
          if (targetClipId) state.updateClipColorGrade(targetClipId, { lutId: act.lutId }, true);
          break;
        case 'RESET_COLOR':
          if (targetClipId) state.resetClipColorGrade(targetClipId);
          break;
        case 'SET_SCALE':
          if (targetClipId) {
            state.updateClipTransform(
              targetClipId,
              { scaleX: act.scale, scaleY: act.scale },
              true
            );
          }
          break;
        case 'ADD_TRANSITION':
          if (targetClipId) state.setClipTransition(targetClipId, 'in', act.transition, 0.6);
          break;
        case 'SET_VHS_GLITCH':
          if (targetClipId) state.updateClipGpuFx(targetClipId, { vhsGlitch: act.amount }, true);
          break;
        case 'SET_FILM_GRAIN':
          if (targetClipId) state.updateClipGpuFx(targetClipId, { filmGrain: act.amount }, true);
          break;
        case 'ENABLE_CHROMA_KEY':
          if (targetClipId) {
            state.updateClipChromaKey(targetClipId, { enabled: true, keyColor: act.color }, true);
          }
          break;
        case 'SPLIT_AT_PLAYHEAD':
          if (targetClipId) state.splitClipAtTime(targetClipId, state.playhead);
          break;
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || busy) return;
    const text = prompt.trim();
    setPrompt('');
    setLogs((prev) => [...prev, { role: 'user', text }]);
    setBusy(true);
    try {
      const plan = await runAIDirector(text, provider, apiKey);
      executeActions(plan.actions);
      setLogs((prev) => [
        ...prev,
        { role: 'director', text: `[${plan.source.toUpperCase()}] ${plan.summary}` },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed top-11 right-0 bottom-6 w-96 z-40 bg-[#111318] border-l border-[#222631] shadow-2xl flex flex-col">
      <div className="h-10 px-3 bg-[#0E1015] border-b border-[#222631] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-200">
            AI Edit Director
          </span>
        </div>
        <button type="button" onClick={onClose} className="text-zinc-400 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-2.5 border-b border-[#222631] bg-[#0D0F14] space-y-2">
        <div className="grid grid-cols-3 gap-1">
          {(
            [
              ['offline', 'Offline (Free)'],
              ['gemini', 'Gemini 2.5'],
              ['groq', 'Groq Fast'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setProvider(id)}
              className={`py-1 rounded text-[10px] font-mono font-semibold border ${
                provider === id
                  ? 'bg-amber-500 text-black border-amber-400'
                  : 'bg-[#171A21] text-zinc-400 border-[#222631]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {provider !== 'offline' && (
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={`Optional ${provider.toUpperCase()} API Key (RAM only)`}
            className="w-full bg-[#0A0B0E] border border-[#222631] rounded px-2 py-1 text-[11px] text-zinc-200 outline-none"
          />
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {logs.map((entry, idx) => (
          <div
            key={idx}
            className={`p-2 rounded text-xs ${
              entry.role === 'user'
                ? 'bg-cyan-500/15 border border-cyan-500/30 text-cyan-100 ml-6'
                : 'bg-[#171A21] border border-[#222631] text-zinc-200 mr-4'
            }`}
          >
            {entry.text}
          </div>
        ))}
      </div>

      <div className="px-3 py-1.5 flex flex-wrap gap-1 border-t border-[#222631] bg-[#0E1015]">
        {['Apply teal orange lut', 'Zoom 1.3x', 'Switch to 9:16 reels', 'Cut silences'].map(
          (chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => setPrompt(chip)}
              className="px-2 py-0.5 rounded bg-[#171A21] hover:bg-[#222631] border border-[#222631] text-[10px] text-zinc-300 flex items-center gap-1"
            >
              <Sparkles className="w-2.5 h-2.5 text-amber-400" />
              {chip}
            </button>
          )
        )}
      </div>

      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="p-2.5 border-t border-[#222631] flex gap-1.5"
      >
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Command CineForge Pro..."
          className="flex-1 bg-[#0A0B0E] border border-[#222631] rounded px-2.5 py-1.5 text-xs text-zinc-100 outline-none focus:border-amber-500"
        />
        <button
          type="submit"
          disabled={busy}
          className="px-3 rounded bg-amber-500 hover:bg-amber-400 text-black font-bold flex items-center justify-center"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
