import { solveClipTransform } from '../animation/keyframeSolver';
import { evaluateClipTransitions } from '../animation/transitions';
import { renderKaraokeCaption } from '../ai/captionEngine';
import { WebGLCompositor } from '../webgl/WebGLCompositor';
import { CaptionSegment } from '../../types/ai';
import { MediaAsset, TimelineClip, TimelineTrack } from '../../types/timeline';
import { renderSyntheticFrame } from '../../utils/syntheticMedia';

export type ExportResolutionPreset = '1080p' | '4k' | 'reels-9-16';

export interface ExportConfig {
  resolution: ExportResolutionPreset;
  fps: 30 | 60;
  bitrateMbps: number;
  fileName: string;
}

export interface ExportProgress {
  percent: number;
  currentTime: number;
  totalDuration: number;
  etaSeconds: number;
  status: string;
}

export function getExportDimensions(preset: ExportResolutionPreset): {
  width: number;
  height: number;
} {
  switch (preset) {
    case '4k':
      return { width: 3840, height: 2160 };
    case 'reels-9-16':
      return { width: 1080, height: 1920 };
    case '1080p':
    default:
      return { width: 1920, height: 1080 };
  }
}

export async function renderTimelineLocally(
  params: {
    tracks: TimelineTrack[];
    clips: TimelineClip[];
    assets: MediaAsset[];
    captions: CaptionSegment[];
    config: ExportConfig;
  },
  onProgress: (p: ExportProgress) => void,
  signal: AbortSignal
): Promise<Blob> {
  const { tracks, clips, assets, captions, config } = params;
  const { width, height } = getExportDimensions(config.resolution);

  const totalDuration = Math.max(
    1,
    clips.reduce((max, c) => Math.max(max, c.startTime + c.duration), 0)
  );

  const outCanvas = document.createElement('canvas');
  outCanvas.width = width;
  outCanvas.height = height;
  const outCtx = outCanvas.getContext('2d', { alpha: false });
  if (!outCtx) throw new Error('Unable to initialize export canvas.');

  const layerCanvas = document.createElement('canvas');
  layerCanvas.width = width;
  layerCanvas.height = height;
  const layerCtx = layerCanvas.getContext('2d');
  if (!layerCtx) throw new Error('Unable to initialize layer canvas.');

  const compositor = new WebGLCompositor();

  const videoMap = new Map<string, HTMLVideoElement>();
  const imageMap = new Map<string, HTMLImageElement>();
  const audioBufferMap = new Map<string, AudioBuffer>();

  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  const exportAudioCtx = new AudioCtx();
  const audioDest = exportAudioCtx.createMediaStreamDestination();

  onProgress({
    percent: 2,
    currentTime: 0,
    totalDuration,
    etaSeconds: Math.ceil(totalDuration),
    status: 'Preloading full-resolution media & mixing audio bus...',
  });

  for (const asset of assets) {
    if (asset.kind === 'image' && asset.url) {
      const img = new Image();
      img.src = asset.url;
      await img.decode().catch(() => {});
      imageMap.set(asset.id, img);
    } else if (asset.kind === 'video' && asset.url) {
      const vid = document.createElement('video');
      vid.src = asset.url;
      vid.muted = true;
      vid.playsInline = true;
      vid.preload = 'auto';
      videoMap.set(asset.id, vid);
    } else if (asset.kind === 'audio' && asset.url) {
      try {
        const res = await fetch(asset.url);
        const ab = await res.arrayBuffer();
        const decoded = await exportAudioCtx.decodeAudioData(ab);
        audioBufferMap.set(asset.id, decoded);
      } catch {
        // Skip unreadable audio
      }
    }
  }

  const hasSoloAudio = tracks.some((t) => t.type === 'audio' && t.solo);
  const audioStartOrigin = exportAudioCtx.currentTime + 0.08;

  tracks
    .filter((t) => t.type === 'audio')
    .forEach((track) => {
      const audible = !track.muted && (!hasSoloAudio || track.solo);
      if (!audible) return;

      const eqLow = exportAudioCtx.createBiquadFilter();
      eqLow.type = 'lowshelf';
      eqLow.frequency.value = 120;
      eqLow.gain.value = track.eqLow;

      const eqMid = exportAudioCtx.createBiquadFilter();
      eqMid.type = 'peaking';
      eqMid.frequency.value = 1000;
      eqMid.gain.value = track.eqMid;

      const eqHigh = exportAudioCtx.createBiquadFilter();
      eqHigh.type = 'highshelf';
      eqHigh.frequency.value = 8000;
      eqHigh.gain.value = track.eqHigh;

      const panner = exportAudioCtx.createStereoPanner();
      panner.pan.value = track.pan;

      const gain = exportAudioCtx.createGain();
      gain.gain.value = track.volume;

      eqLow.connect(eqMid);
      eqMid.connect(eqHigh);
      eqHigh.connect(panner);
      panner.connect(gain);
      gain.connect(audioDest);

      clips
        .filter((c) => c.trackId === track.id && !c.muted && c.assetId)
        .forEach((clip) => {
          const buf = clip.assetId ? audioBufferMap.get(clip.assetId) : undefined;
          if (!buf) return;
          const src = exportAudioCtx.createBufferSource();
          src.buffer = buf;
          src.playbackRate.value = clip.speed;
          const clipGain = exportAudioCtx.createGain();
          clipGain.gain.value = clip.volume;
          src.connect(clipGain);
          clipGain.connect(eqLow);
          src.start(
            audioStartOrigin + clip.startTime,
            Math.max(0, clip.trimIn),
            Math.max(0.05, clip.duration * clip.speed)
          );
        });
    });

  const videoStream = outCanvas.captureStream(config.fps);
  const combinedStream = new MediaStream([
    ...videoStream.getVideoTracks(),
    ...audioDest.stream.getAudioTracks(),
  ]);

  const preferredMimes = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4',
  ];
  const mimeType =
    preferredMimes.find((m) => MediaRecorder.isTypeSupported(m)) ?? 'video/webm';

  const recorder = new MediaRecorder(combinedStream, {
    mimeType,
    videoBitsPerSecond: config.bitrateMbps * 1_000_000,
  });

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const recordingFinished = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
    recorder.onerror = () => reject(new Error('MediaRecorder encoding failed.'));
  });

  const hasSoloVideo = tracks.some((t) => (t.type === 'video' || t.type === 'text') && t.solo);
  const visualTracks = [...tracks]
    .filter((t) => t.type === 'video' || t.type === 'text' || t.type === 'adjustment')
    .reverse();

  recorder.start(250);
  const startWall = performance.now();

  try {
    await new Promise<void>((resolve, reject) => {
      const step = () => {
        if (signal.aborted) {
          reject(new Error('Export cancelled by user.'));
          return;
        }

        const elapsed = (performance.now() - startWall) / 1000;
        const currentTime = Math.min(totalDuration, elapsed);

        outCtx.fillStyle = '#050608';
        outCtx.fillRect(0, 0, width, height);

        visualTracks.forEach((track) => {
          if (!track.visible) return;
          if (hasSoloVideo && !track.solo) return;

          const activeClips = clips.filter(
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

            layerCtx.clearRect(0, 0, width, height);
            if (clip.kind === 'text' && clip.textData) {
              const scaleFactor = height / 1080;
              const fontSize = Math.max(14, Math.round(clip.textData.fontSize * scaleFactor));
              layerCtx.font = `${clip.textData.fontWeight} ${fontSize}px ${clip.textData.fontFamily}`;
              layerCtx.textAlign = clip.textData.align;
              layerCtx.textBaseline = 'middle';
              const metrics = layerCtx.measureText(clip.textData.content);
              const padX = fontSize * 0.6;
              const padY = fontSize * 0.35;
              layerCtx.fillStyle = clip.textData.backgroundColor;
              layerCtx.fillRect(
                width * 0.5 - metrics.width / 2 - padX,
                height * 0.5 - fontSize / 2 - padY,
                metrics.width + padX * 2,
                fontSize + padY * 2
              );
              layerCtx.fillStyle = clip.textData.color;
              layerCtx.fillText(clip.textData.content, width * 0.5, height * 0.5);
            } else if (clip.assetId) {
              const asset = assets.find((a) => a.id === clip.assetId);
              if (asset?.kind === 'synthetic' && asset.syntheticPattern) {
                renderSyntheticFrame(layerCtx, asset.syntheticPattern, width, height, localTime);
              } else if (asset?.kind === 'image') {
                const img = imageMap.get(asset.id);
                if (img) layerCtx.drawImage(img, 0, 0, width, height);
              } else if (asset?.kind === 'video') {
                const vid = videoMap.get(asset.id);
                if (vid && vid.readyState >= 2) {
                  if (Math.abs(vid.currentTime - localTime) > 0.15) vid.currentTime = localTime;
                  layerCtx.drawImage(vid, 0, 0, width, height);
                }
              }
            }

            const graded = compositor.processLayer({
              source: layerCanvas,
              width,
              height,
              time: currentTime,
              opacity: solvedTransform.opacity * trMod.opacityMultiplier,
              dipBlack: trMod.dipBlack,
              colorGrade: clip.colorGrade,
              chromaKey: clip.chromaKey,
              gpuFx: {
                blur: Math.min(1, clip.gpuFx.blur + trMod.extraBlur),
                chromaticAberration: Math.min(1, clip.gpuFx.chromaticAberration + trMod.extraChromatic),
                vhsGlitch: Math.min(1, clip.gpuFx.vhsGlitch + trMod.extraGlitch),
                filmGrain: clip.gpuFx.filmGrain,
              },
            });

            outCtx.save();
            outCtx.translate(
              width * (0.5 + solvedTransform.x + trMod.offsetX),
              height * (0.5 + solvedTransform.y)
            );
            outCtx.rotate((solvedTransform.rotation * Math.PI) / 180);
            outCtx.scale(
              solvedTransform.scaleX * trMod.scaleMultiplier,
              solvedTransform.scaleY * trMod.scaleMultiplier
            );
            outCtx.drawImage(graded, -width / 2, -height / 2, width, height);
            outCtx.restore();
          });
        });

        captions.forEach((cap) => {
          if (currentTime >= cap.startTime && currentTime <= cap.endTime) {
            renderKaraokeCaption(outCtx, cap, currentTime, width, height);
          }
        });

        const pct = Math.min(99, Math.round((currentTime / totalDuration) * 100));
        onProgress({
          percent: pct,
          currentTime,
          totalDuration,
          etaSeconds: Math.max(0, Math.ceil(totalDuration - currentTime)),
          status: `Rendering ${width}×${height} @ ${config.fps}fps...`,
        });

        if (currentTime >= totalDuration) {
          resolve();
          return;
        }
        requestAnimationFrame(step);
      };

      requestAnimationFrame(step);
    });
  } finally {
    if (recorder.state !== 'inactive') recorder.stop();
    await exportAudioCtx.close().catch(() => {});
    compositor.dispose();
  }

  const finalBlob = await recordingFinished;
  onProgress({
    percent: 100,
    currentTime: totalDuration,
    totalDuration,
    etaSeconds: 0,
    status: 'Export complete — zero watermark.',
  });
  return finalBlob;
}
