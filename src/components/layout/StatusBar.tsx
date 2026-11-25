import React from 'react';
import { Activity, Cpu } from 'lucide-react';
import { useProjectStore } from '../../store/projectStore';

export const StatusBar: React.FC = () => {
  const telemetry = useProjectStore((s) => s.telemetry);
  const proxyQuality = useProjectStore((s) => s.proxyQuality);
  const activeTool = useProjectStore((s) => s.activeTool);
  const clipCount = useProjectStore((s) => s.clips.length);

  const fpsColor =
    telemetry.fps >= 50
      ? 'text-emerald-400'
      : telemetry.fps >= 28
        ? 'text-amber-400'
        : 'text-red-400';

  return (
    <footer className="h-6 px-3 bg-[#0A0B0E] border-t border-[#222631] flex items-center justify-between text-[10px] font-mono text-zinc-400 shrink-0">
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1">
          <Activity className={`w-3 h-3 ${fpsColor}`} />
          <strong className={fpsColor}>{telemetry.fps} FPS</strong>
          <span className="text-zinc-600">({telemetry.frameTimeMs}ms)</span>
        </span>

        <span>
          GPU: <strong className="text-emerald-400">{telemetry.rendererBackend}</strong>
        </span>

        <span>
          PROXY:{' '}
          <strong className="text-amber-400">
            {proxyQuality === '1' ? 'FULL' : `${Number(proxyQuality) * 100}%`}
          </strong>{' '}
          ({telemetry.renderWidth}×{telemetry.renderHeight})
        </span>

        <span className="flex items-center gap-1">
          <Cpu className="w-3 h-3 text-cyan-400" />
          MEM:{' '}
          {telemetry.heapUsedMb !== null
            ? `${telemetry.heapUsedMb}MB / ${telemetry.heapLimitMb ?? '?'}MB`
            : 'LOW-RAM MODE'}
        </span>
      </div>

      <div className="flex items-center gap-4 text-zinc-500">
        <span>CLIPS: {clipCount}</span>
        <span>TOOL: {activeTool.toUpperCase()}</span>
        <span className="hidden lg:inline">
          [SPACE] Play · [J/K/L] Shuttle · [V] Select · [C] Razor · [SHIFT+DEL] Ripple · [CTRL+Z] Undo
        </span>
      </div>
    </footer>
  );
};
