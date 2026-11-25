import React, { useEffect, useMemo, useRef } from 'react';
import { FastForward, Monitor, Pause, Play, Rewind, SkipBack } from 'lucide-react';
import { renderKaraokeCaption } from '../../engine/ai/captionEngine';
import { solveClipTransform } from '../../engine/animation/keyframeSolver';
import { evaluateClipTransitions } from '../../engine/animation/transitions';
import { audioMixer } from '../../engine/audio/AudioMixer';
import { scopeBus } from '../../engine/webgl/scopeBus';
import { WebGLCompositor } from '../../engine/webgl/WebGLCompositor';
import { useProjectStore } from '../../store/projectStore';
import {
  ASPECT_RESOLUTIONS,
  AspectRatioPreset,
  ProxyQuality,
} from '../../types/timeline';
import { renderSyntheticFrame } from '../../utils/syntheticMedia';
import { formatTimecode } from '../../utils/timecode';

interface PerformanceWithMemory extends Performance {
  memory?: {
    usedJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
}

const PROXY_OPTIONS: { value: ProxyQuality; label: string }[] = [
  { value: '0.25', label: '1/4' },
  { value: '0.5', label: '1/2' },
  { value: '1', label: 'Full' },
];

const ASPECT_OPTIONS: AspectRatioPreset[] = ['16:9', '9:16', '1:1', '21:9'];

export const ProgramMonitor: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const scopeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const compositorRef = useRef<WebGLCompositor | null>(null);

  const videoElementsRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const imageElementsRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  const playhead = useProjectStore((s) => s.playhead);
  const isPlaying = useProjectStore((s) => s.isPlaying);
  const shuttleRate = useProjectStore((s) => s.shuttleRate);
  const fps = useProjectStore((s) => s.fps);
  const aspectRatio = useProjectStore((s) => s.aspectRatio);
  const proxyQuality = useProjectStore((s) => s.proxyQuality);
  const assets = useProjectStore((s) => s.assets);
  const rendererBackend = useProjectStore((s) => s.telemetry.rendererBackend);

  const setPlayhead = useProjectStore((s) => s.setPlayhead);
  const togglePlay = useProjectStore((s) => s.togglePlay);
  const shuttle = useProjectStore((s) => s.shuttle);
  const setAspectRatio = useProjectStore((s) => s.setAspectRatio);
  const setProxyQuality = useProjectStore((s) => s.setProxyQuality);
  const setTelemetry = useProjectStore((s) => s.setTelemetry);

  const renderDimensions = useMemo(() => {
    const base = ASPECT_RESOLUTIONS[aspectRatio];
    const scale = parseFloat(proxyQuality);
    return {
      width: Math.max(160, Math.round(base.width * scale)),
      height: Math.max(90, Math.round(base.height * scale)),
    };
  }, [aspectRatio, proxyQuality]);

  useEffect(() => {
    const activeIds = new Set(assets.map((a) => a.id));
    audioElementsRef.current.forEach((el, id) => {
      if (!activeIds.has(id)) {
        el.pause();
        el.src = '';
        audioElementsRef.current.delete(id);
      }
    });
    videoElementsRef.current.forEach((el, id) => {
      if (!activeIds.has(id)) {
        el.pause();
        el.src = '';
        videoElementsRef.current.delete(id);
      }
    });

    assets.forEach((asset) => {
      if (asset.kind === 'video' && asset.url && !videoElementsRef.current.has(asset.id)) {
        const video = document.createElement('video');
        video.src = asset.url;
        video.muted = true;
        video.playsInline = true;
        video.preload = 'auto';
        videoElementsRef.current.set(asset.id, video);
      } else if (asset.kind === 'image' && asset.url && !imageElementsRef.current.has(asset.id)) {
        const img = new Image();
        img.src = asset.url;
        imageElementsRef.current.set(asset.id, img);
      } else if (asset.kind === 'audio' && asset.url && !audioElementsRef.current.has(asset.id)) {
        const audio = new Audio(asset.url);
        audio.preload = 'auto';
        audioElementsRef.current.set(asset.id, audio);
      }
    });
  }, [assets]);

  useEffect(() => {
    return () => {
      compositorRef.current?.dispose();
      compositorRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!compositorRef.current) {
      compositorRef.current = new WebGLCompositor();
    }
    if (!layerCanvasRef.current) {
      layerCanvasRef.current = document.createElement('canvas');
    }
    if (!scopeCanvasRef.current) {
      const sc = document.createElement('canvas');
      sc.width = 128;
      sc.height = 72;
      scopeCanvasRef.current = sc;
    }

    const compositor = compositorRef.current;
    const layerCanvas = layerCanvasRef.current;
    const scopeCanvas = scopeCanvasRef.current;

    let rafId = 0;
    let lastTimestamp = performance.now();
    let fpsAccumulator = 0;
    let frameCount = 0;

    const renderFrame = (now: number) => {
      const dtSec = Math.min(0.1, (now - lastTimestamp) / 1000);
      lastTimestamp = now;

      const state = useProjectStore.getState();
      let currentTime = state.playhead;

      if (state.isPlaying) {
        currentTime = Math.max(0, currentTime + dtSec * (state.shuttleRate || 1));
        state.setPlayhead(currentTime);
      }

      const canvas = canvasRef.current;
      if (canvas) {
        if (canvas.width !== renderDimensions.width || canvas.height !== renderDimensions.height) {
          canvas.width = renderDimensions.width;
          canvas.height = renderDimensions.height;
        }
        if (layerCanvas.width !== canvas.width || layerCanvas.height !== canvas.height) {
          layerCanvas.width = canvas.width;
          layerCanvas.height = canvas.height;
        }

        const ctx = canvas.getContext('2d', { alpha: false });
        const layerCtx = layerCanvas.getContext('2d');

        if (ctx && layerCtx) {
          const w = canvas.width;
          const h = canvas.height;
          ctx.fillStyle = '#050608';
          ctx.fillRect(0, 0, w, h);

          const hasSoloVideo = state.tracks.some(
            (t) => (t.type === 'video' || t.type === 'text') && t.solo
          );
          const hasSoloAudio = state.tracks.some((t) => t.type === 'audio' && t.solo);

          const visualTracks = [...state.tracks]
            .filter((t) => t.type === 'video' || t.type === 'text' || t.type === 'adjustment')
            .reverse();

          visualTracks.forEach((track) => {
            if (!track.visible) return;
            if (hasSoloVideo && !track.solo) return;

            const activeClips = state.clips.filter(
              (c) =>
                c.trackId === track.id &&
                currentTime >= c.startTime &&
                currentTime < c.startTime + c.duration
            );

            activeClips.forEach((clip) => {
              const clipElapsed = currentTime - clip.startTime;
              const localTime = clip.trimIn + clipElapsed * clip.speed;
              const solvedTransform = solveClipTransform(clip.transform, clip.keyframes, clipElapsed);
              const trMod = evaluateClipTransitions(clip.transitions, clipElapsed, clip.duration);

              layerCtx.clearRect(0, 0, w, h);
              if (clip.kind === 'text' && clip.textData) {
                const scaleFactor = h / 1080;
                const fontSize = Math.max(11, Math.round(clip.textData.fontSize * scaleFactor));
                layerCtx.font = `${clip.textData.fontWeight} ${fontSize}px ${clip.textData.fontFamily}`;
                layerCtx.textAlign = clip.textData.align;
                layerCtx.textBaseline = 'middle';
                const metrics = layerCtx.measureText(clip.textData.content);
                const padX = fontSize * 0.6;
                const padY = fontSize * 0.35;
                layerCtx.fillStyle = clip.textData.backgroundColor;
                layerCtx.fillRect(
                  w * 0.5 - metrics.width / 2 - padX,
                  h * 0.5 - fontSize / 2 - padY,
                  metrics.width + padX * 2,
                  fontSize + padY * 2
                );
                layerCtx.fillStyle = clip.textData.color;
                layerCtx.fillText(clip.textData.content, w * 0.5, h * 0.5);
              } else if (clip.assetId) {
                const asset = state.assets.find((a) => a.id === clip.assetId);
                if (asset?.kind === 'synthetic' && asset.syntheticPattern) {
                  renderSyntheticFrame(layerCtx, asset.syntheticPattern, w, h, localTime);
                } else if (asset?.kind === 'image') {
                  const img = imageElementsRef.current.get(asset.id);
                  if (img && img.complete) layerCtx.drawImage(img, 0, 0, w, h);
                } else if (asset?.kind === 'video') {
                  const video = videoElementsRef.current.get(asset.id);
                  if (video && video.readyState >= 2) {
                    if (Math.abs(video.currentTime - localTime) > 0.18) {
                      video.currentTime = localTime;
                    }
                    layerCtx.drawImage(video, 0, 0, w, h);
                  }
                }
              }

              const gradedCanvas = compositor.processLayer({
                source: layerCanvas,
                width: w,
                height: h,
                time: currentTime,
                opacity: solvedTransform.opacity * trMod.opacityMultiplier,
                dipBlack: trMod.dipBlack,
                colorGrade: clip.colorGrade,
                chromaKey: clip.chromaKey,
                gpuFx: {
                  blur: Math.min(1, clip.gpuFx.blur + trMod.extraBlur),
                  chromaticAberration: Math.min(
                    1,
                    clip.gpuFx.chromaticAberration + trMod.extraChromatic
                  ),
                  vhsGlitch: Math.min(1, clip.gpuFx.vhsGlitch + trMod.extraGlitch),
                  filmGrain: clip.gpuFx.filmGrain,
                },
              });

              ctx.save();
              const tx = w * (0.5 + solvedTransform.x + trMod.offsetX);
              const ty = h * (0.5 + solvedTransform.y);
              ctx.translate(tx, ty);
              ctx.rotate((solvedTransform.rotation * Math.PI) / 180);
              ctx.scale(
                solvedTransform.scaleX * trMod.scaleMultiplier,
                solvedTransform.scaleY * trMod.scaleMultiplier
              );
              ctx.drawImage(gradedCanvas, -w / 2, -h / 2, w, h);
              ctx.restore();
            });
          });

          state.captions.forEach((cap) => {
            if (currentTime >= cap.startTime && currentTime <= cap.endTime) {
              renderKaraokeCaption(ctx, cap, currentTime, w, h);
            }
          });

          if (scopeBus.hasListeners()) {
            const sCtx = scopeCanvas.getContext('2d', { willReadFrequently: true });
            if (sCtx) {
              sCtx.drawImage(canvas, 0, 0, scopeCanvas.width, scopeCanvas.height);
              const imgData = sCtx.getImageData(0, 0, scopeCanvas.width, scopeCanvas.height);
              scopeBus.emit({
                data: imgData.data,
                width: scopeCanvas.width,
                height: scopeCanvas.height,
              });
            }
          }

          const activeAudioIds = new Set<string>();
          state.tracks
            .filter((t) => t.type === 'audio')
            .forEach((track) => {
              const audible = !track.muted && (!hasSoloAudio || track.solo);
              audioMixer.syncTrackParams(track, audible);
              if (!audible || !state.isPlaying || state.shuttleRate !== 1) return;

              const activeAudio = state.clips.filter(
                (c) =>
                  c.trackId === track.id &&
                  !c.muted &&
                  currentTime >= c.startTime &&
                  currentTime < c.startTime + c.duration
              );

              activeAudio.forEach((clip) => {
                if (!clip.assetId) return;
                const audioEl = audioElementsRef.current.get(clip.assetId);
                if (!audioEl) return;
                audioMixer.routeAudioElement(audioEl, track.id);
                activeAudioIds.add(clip.assetId);
                audioEl.volume = Math.max(0, Math.min(1, clip.volume));
                const targetAudioTime = clip.trimIn + (currentTime - clip.startTime) * clip.speed;
                if (Math.abs(audioEl.currentTime - targetAudioTime) > 0.2) {
                  audioEl.currentTime = targetAudioTime;
                }
                if (audioEl.paused) {
                  void audioEl.play().catch(() => {});
                }
              });
            });

          audioElementsRef.current.forEach((audioEl, assetId) => {
            if (!activeAudioIds.has(assetId) && !audioEl.paused) {
              audioEl.pause();
            }
          });
        }
      }

      frameCount += 1;
      fpsAccumulator += dtSec;
      if (fpsAccumulator >= 0.5) {
        const measuredFps = Math.round(frameCount / fpsAccumulator);
        const perf = performance as PerformanceWithMemory;
        setTelemetry({
          fps: measuredFps,
          frameTimeMs: Number(((fpsAccumulator / frameCount) * 1000).toFixed(1)),
          renderWidth: renderDimensions.width,
          renderHeight: renderDimensions.height,
          heapUsedMb: perf.memory ? Math.round(perf.memory.usedJSHeapSize / (1024 * 1024)) : null,
          heapLimitMb: perf.memory ? Math.round(perf.memory.jsHeapSizeLimit / (1024 * 1024)) : null,
          rendererBackend: compositor.backend,
        });
        frameCount = 0;
        fpsAccumulator = 0;
      }

      rafId = requestAnimationFrame(renderFrame);
    };

    rafId = requestAnimationFrame(renderFrame);
    return () => {
      cancelAnimationFrame(rafId);
      audioElementsRef.current.forEach((el) => el.pause());
    };
  }, [renderDimensions, setTelemetry]);

  return (
    <section className="flex-1 bg-[#0A0B0E] flex flex-col min-w-0 min-h-0">
      <div className="h-9 px-3 bg-[#111318] border-b border-[#222631] flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <Monitor className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-300">
            Program Monitor
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            {rendererBackend}
          </span>
          <span className="text-[10px] font-mono text-zinc-500 hidden xl:inline">
            {renderDimensions.width}×{renderDimensions.height}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[#0A0B0E] border border-[#222631] rounded p-0.5">
            {ASPECT_OPTIONS.map((ratio) => (
              <button
                key={ratio}
                type="button"
                onClick={() => setAspectRatio(ratio)}
                className={`px-1.5 py-0.5 text-[10px] font-mono rounded transition-colors ${
                  aspectRatio === ratio
                    ? 'bg-cyan-500/20 text-cyan-300 font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {ratio}
              </button>
            ))}
          </div>

          <div className="flex items-center bg-[#0A0B0E] border border-[#222631] rounded p-0.5">
            {PROXY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setProxyQuality(opt.value)}
                className={`px-1.5 py-0.5 text-[10px] font-mono rounded transition-colors ${
                  proxyQuality === opt.value
                    ? 'bg-amber-500 text-black font-bold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex items-center justify-center p-4 bg-[#07080B] overflow-hidden">
        <canvas
          ref={canvasRef}
          style={{ aspectRatio: `${renderDimensions.width} / ${renderDimensions.height}` }}
          className="max-w-full max-h-full bg-black border border-[#222631] shadow-2xl"
        />
      </div>

      <div className="h-11 px-4 bg-[#111318] border-t border-[#222631] flex items-center justify-between shrink-0">
        <div className="font-mono text-sm font-semibold text-amber-400 tracking-wider w-32">
          {formatTimecode(playhead, fps)}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            title="Jump to Start"
            onClick={() => setPlayhead(0)}
            className="p-1.5 rounded hover:bg-[#222631] text-zinc-300 transition-colors"
          >
            <SkipBack className="w-4 h-4" />
          </button>
          <button
            type="button"
            title="Shuttle Reverse (J)"
            onClick={() => shuttle('reverse')}
            className={`p-1.5 rounded hover:bg-[#222631] transition-colors ${
              isPlaying && shuttleRate < 0 ? 'text-cyan-400 bg-cyan-500/10' : 'text-zinc-300'
            }`}
          >
            <Rewind className="w-4 h-4" />
          </button>
          <button
            type="button"
            title="Play / Pause (Space)"
            onClick={togglePlay}
            className="px-3 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-black font-semibold flex items-center gap-1 transition-colors"
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-current" />
            ) : (
              <Play className="w-4 h-4 fill-current" />
            )}
          </button>
          <button
            type="button"
            title="Shuttle Forward (L)"
            onClick={() => shuttle('forward')}
            className={`p-1.5 rounded hover:bg-[#222631] transition-colors ${
              isPlaying && shuttleRate > 1 ? 'text-cyan-400 bg-cyan-500/10' : 'text-zinc-300'
            }`}
          >
            <FastForward className="w-4 h-4" />
          </button>
        </div>

        <div className="w-32 text-right font-mono text-[11px] text-zinc-400">
          {isPlaying ? `${shuttleRate > 0 ? '+' : ''}${shuttleRate}x` : 'STOPPED'} · {fps}fps
        </div>
      </div>
    </section>
  );
};
