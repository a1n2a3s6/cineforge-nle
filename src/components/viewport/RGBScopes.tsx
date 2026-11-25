import React, { useEffect, useRef, useState } from 'react';
import { scopeBus } from '../../engine/webgl/scopeBus';

type ScopeMode = 'waveform' | 'histogram';

export const RGBScopes: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<ScopeMode>('waveform');
  const modeRef = useRef<ScopeMode>(mode);
  modeRef.current = mode;

  useEffect(() => {
    const unsubscribe = scopeBus.subscribe(({ data, width, height }) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const cw = canvas.width;
      const ch = canvas.height;
      ctx.fillStyle = '#07080B';
      ctx.fillRect(0, 0, cw, ch);

      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      for (let i = 1; i <= 3; i += 1) {
        const gy = (ch / 4) * i;
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(cw, gy);
        ctx.stroke();
      }

      if (modeRef.current === 'histogram') {
        const bins = 64;
        const rHist = new Uint32Array(bins);
        const gHist = new Uint32Array(bins);
        const bHist = new Uint32Array(bins);

        for (let i = 0; i < data.length; i += 4) {
          rHist[data[i] >> 2] += 1;
          gHist[data[i + 1] >> 2] += 1;
          bHist[data[i + 2] >> 2] += 1;
        }

        let maxCount = 1;
        for (let i = 0; i < bins; i += 1) {
          if (rHist[i] > maxCount) maxCount = rHist[i];
          if (gHist[i] > maxCount) maxCount = gHist[i];
          if (bHist[i] > maxCount) maxCount = bHist[i];
        }

        const drawChannel = (hist: Uint32Array, color: string) => {
          ctx.fillStyle = color;
          const barW = cw / bins;
          for (let i = 0; i < bins; i += 1) {
            const norm = Math.sqrt(hist[i] / maxCount);
            const h = norm * (ch - 6);
            ctx.fillRect(i * barW, ch - h, Math.max(1, barW), h);
          }
        };

        ctx.globalCompositeOperation = 'lighter';
        drawChannel(rHist, 'rgba(239, 68, 68, 0.55)');
        drawChannel(gHist, 'rgba(16, 185, 129, 0.55)');
        drawChannel(bHist, 'rgba(6, 182, 212, 0.6)');
        ctx.globalCompositeOperation = 'source-over';
        return;
      }

      const colW = cw / 3;
      const stepX = Math.max(1, Math.floor(width / 72));
      const stepY = Math.max(1, Math.floor(height / 48));

      for (let y = 0; y < height; y += stepY) {
        for (let x = 0; x < width; x += stepX) {
          const idx = (y * width + x) * 4;
          const nx = x / width;

          const ry = ch - (data[idx] / 255) * (ch - 4) - 2;
          const gy = ch - (data[idx + 1] / 255) * (ch - 4) - 2;
          const by = ch - (data[idx + 2] / 255) * (ch - 4) - 2;

          ctx.fillStyle = 'rgba(239, 68, 68, 0.42)';
          ctx.fillRect(nx * colW, ry, 1.5, 1.5);

          ctx.fillStyle = 'rgba(16, 185, 129, 0.42)';
          ctx.fillRect(colW + nx * colW, gy, 1.5, 1.5);

          ctx.fillStyle = 'rgba(6, 182, 212, 0.45)';
          ctx.fillRect(colW * 2 + nx * colW, by, 1.5, 1.5);
        }
      }
    });

    return unsubscribe;
  }, []);

  return (
    <div className="bg-[#0A0B0E] border border-[#222631] rounded p-2">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
          Live RGB Scope
        </span>
        <div className="flex items-center gap-1 bg-[#111318] border border-[#222631] rounded p-0.5">
          <button
            type="button"
            onClick={() => setMode('waveform')}
            className={`px-1.5 py-0.5 text-[9px] font-mono rounded ${
              mode === 'waveform' ? 'bg-amber-500 text-black font-bold' : 'text-zinc-400'
            }`}
          >
            PARADE
          </button>
          <button
            type="button"
            onClick={() => setMode('histogram')}
            className={`px-1.5 py-0.5 text-[9px] font-mono rounded ${
              mode === 'histogram' ? 'bg-amber-500 text-black font-bold' : 'text-zinc-400'
            }`}
          >
            HIST
          </button>
        </div>
      </div>
      <canvas
        ref={canvasRef}
        width={264}
        height={96}
        className="w-full h-24 rounded border border-[#1B1F29] bg-[#07080B]"
      />
    </div>
  );
};
