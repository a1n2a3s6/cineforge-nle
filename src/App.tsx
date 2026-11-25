import React, { useEffect, useState } from 'react';
import { AIDirectorDrawer } from './components/ai/AIDirectorDrawer';
import { AutoSilenceModal } from './components/ai/AutoSilenceModal';
import { BeatSyncModal } from './components/ai/BeatSyncModal';
import { ExportModal } from './components/export/ExportModal';
import { InspectorPanel } from './components/inspector/InspectorPanel';
import { StatusBar } from './components/layout/StatusBar';
import { TopBar } from './components/layout/TopBar';
import { MediaBin } from './components/media/MediaBin';
import { Timeline } from './components/timeline/Timeline';
import { ProgramMonitor } from './components/viewport/ProgramMonitor';
import { useProjectStore } from './store/projectStore';

export const App: React.FC = () => {
  const [silenceOpen, setSilenceOpen] = useState(false);
  const [beatOpen, setBeatOpen] = useState(false);
  const [directorOpen, setDirectorOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      const state = useProjectStore.getState();
      const key = e.key.toLowerCase();

      if ((e.ctrlKey || e.metaKey) && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) state.redo();
        else state.undo();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && key === 's') {
        e.preventDefault();
        void state.saveToVault();
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        state.togglePlay();
        return;
      }

      if (key === 'j') {
        e.preventDefault();
        state.shuttle('reverse');
        return;
      }
      if (key === 'k') {
        e.preventDefault();
        state.shuttle('stop');
        return;
      }
      if (key === 'l') {
        e.preventDefault();
        state.shuttle('forward');
        return;
      }

      if (key === 'v') {
        state.setActiveTool('select');
        return;
      }
      if (key === 'c') {
        state.setActiveTool('razor');
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        state.deleteSelectedClips(e.shiftKey);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0A0B0E] text-zinc-100 overflow-hidden">
      <TopBar
        onOpenSilence={() => setSilenceOpen(true)}
        onOpenBeat={() => setBeatOpen(true)}
        onToggleDirector={() => setDirectorOpen((v) => !v)}
        onOpenExport={() => setExportOpen(true)}
      />
      <main className="flex-1 flex min-h-0 overflow-hidden">
        <MediaBin />
        <ProgramMonitor />
        <InspectorPanel />
      </main>
      <Timeline />
      <StatusBar />

      {silenceOpen && <AutoSilenceModal onClose={() => setSilenceOpen(false)} />}
      {beatOpen && <BeatSyncModal onClose={() => setBeatOpen(false)} />}
      {exportOpen && <ExportModal onClose={() => setExportOpen(false)} />}
      <AIDirectorDrawer
        open={directorOpen}
        onClose={() => setDirectorOpen(false)}
        onOpenSilence={() => setSilenceOpen(true)}
        onOpenBeat={() => setBeatOpen(true)}
        onOpenExport={() => setExportOpen(true)}
      />
    </div>
  );
};

export default App;
