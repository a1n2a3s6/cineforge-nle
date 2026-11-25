import React from 'react';
import {
  Activity,
  Bot,
  Clapperboard,
  Database,
  Download,
  FolderOpen,
  Redo2,
  Save,
  Scissors,
  Undo2,
} from 'lucide-react';
import { useProjectStore } from '../../store/projectStore';

interface TopBarProps {
  onOpenSilence: () => void;
  onOpenBeat: () => void;
  onToggleDirector: () => void;
  onOpenExport: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  onOpenSilence,
  onOpenBeat,
  onToggleDirector,
  onOpenExport,
}) => {
  const projectName = useProjectStore((s) => s.projectName);
  const setProjectName = useProjectStore((s) => s.setProjectName);
  const pastCount = useProjectStore((s) => s.past.length);
  const futureCount = useProjectStore((s) => s.future.length);
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);
  const saveToVault = useProjectStore((s) => s.saveToVault);
  const restoreLatestFromVault = useProjectStore((s) => s.restoreLatestFromVault);
  const vaultStatus = useProjectStore((s) => s.vaultStatus);

  return (
    <header className="h-11 px-3 bg-[#111318] border-b border-[#222631] flex items-center justify-between gap-2 shrink-0">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-6 h-6 rounded bg-amber-500 flex items-center justify-center text-black">
            <Clapperboard className="w-4 h-4" />
          </div>
          <span className="font-bold text-sm tracking-tight text-zinc-100">
            CINEFORGE <span className="text-amber-400 font-mono text-xs">PRO</span>
          </span>
        </div>

        <div className="w-px h-4 bg-[#222631] shrink-0" />

        <input
          type="text"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          className="bg-transparent hover:bg-[#171A21] focus:bg-[#0A0B0E] border border-transparent focus:border-[#222631] rounded px-2 py-0.5 text-xs font-medium text-zinc-200 outline-none w-48 lg:w-56 truncate"
        />
      </div>

      {/* AI Suite Actions */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onOpenSilence}
          className="px-2 py-1 rounded bg-[#171A21] hover:bg-[#222631] border border-[#222631] text-[11px] font-medium text-zinc-200 flex items-center gap-1 transition-colors"
          title="Offline AI Auto-Silence Cutter"
        >
          <Scissors className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden xl:inline">Silence Cut</span>
        </button>

        <button
          type="button"
          onClick={onOpenBeat}
          className="px-2 py-1 rounded bg-[#171A21] hover:bg-[#222631] border border-[#222631] text-[11px] font-medium text-zinc-200 flex items-center gap-1 transition-colors"
          title="Offline AI Beat-Sync Detector"
        >
          <Activity className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden xl:inline">Beat Sync</span>
        </button>

        <button
          type="button"
          onClick={onToggleDirector}
          className="px-2 py-1 rounded bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-[11px] font-semibold text-amber-300 flex items-center gap-1 transition-colors"
          title="AI Edit Director"
        >
          <Bot className="w-3.5 h-3.5" />
          <span>AI Director</span>
        </button>

        <div className="w-px h-4 bg-[#222631] mx-0.5" />

        {/* 50-Step Undo / Redo */}
        <div className="flex items-center bg-[#0A0B0E] border border-[#222631] rounded p-0.5">
          <button
            type="button"
            disabled={pastCount === 0}
            onClick={undo}
            title="Undo (Ctrl+Z)"
            className="px-1.5 py-0.5 rounded text-zinc-300 hover:bg-[#222631] disabled:opacity-30 flex items-center gap-1 text-[10px] font-mono"
          >
            <Undo2 className="w-3 h-3" />
            <span>{pastCount}</span>
          </button>
          <button
            type="button"
            disabled={futureCount === 0}
            onClick={redo}
            title="Redo (Ctrl+Shift+Z)"
            className="px-1.5 py-0.5 rounded text-zinc-300 hover:bg-[#222631] disabled:opacity-30 flex items-center gap-1 text-[10px] font-mono"
          >
            <Redo2 className="w-3 h-3" />
            <span>{futureCount}</span>
          </button>
        </div>

        {/* IndexedDB Vault */}
        <button
          type="button"
          onClick={() => void saveToVault()}
          title={`Save to IndexedDB (${vaultStatus})`}
          className="px-2 py-1 rounded bg-[#171A21] hover:bg-[#222631] border border-[#222631] text-[11px] font-medium text-emerald-300 flex items-center gap-1"
        >
          <Save className="w-3.5 h-3.5" />
          <span className="hidden 2xl:inline">Save</span>
        </button>

        <button
          type="button"
          onClick={() => void restoreLatestFromVault()}
          title="Restore Last Saved Project from IndexedDB"
          className="p-1.5 rounded bg-[#171A21] hover:bg-[#222631] border border-[#222631] text-cyan-400"
        >
          <FolderOpen className="w-3.5 h-3.5" />
        </button>

        <span className="hidden 2xl:flex items-center gap-1 text-[10px] font-mono text-zinc-500">
          <Database className="w-3 h-3 text-emerald-500" />
          {vaultStatus}
        </span>

        {/* Export Button */}
        <button
          type="button"
          onClick={onOpenExport}
          className="px-3 py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold flex items-center gap-1.5 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export</span>
        </button>
      </div>
    </header>
  );
};
