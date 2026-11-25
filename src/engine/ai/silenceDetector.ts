export interface SilenceRegion {
  start: number;
  end: number;
  duration: number;
}

export interface SilenceAnalysisResult {
  duration: number;
  peaks: number[];
  silences: SilenceRegion[];
}

export interface SilenceDetectionOptions {
  thresholdDb: number;
  minSilenceMs: number;
  paddingMs: number;
}

export async function decodeMediaAudioBuffer(url: string): Promise<AudioBuffer> {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) {
    throw new Error('Web Audio API is not supported in this browser.');
  }
  const ctx = new AudioCtx();
  try {
    return await ctx.decodeAudioData(arrayBuffer);
  } finally {
    await ctx.close();
  }
}

export function detectSilencesFromBuffer(
  buffer: AudioBuffer,
  options: SilenceDetectionOptions
): SilenceAnalysisResult {
  const channel = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;
  const duration = buffer.duration;

  const windowSamples = Math.max(1, Math.floor(sampleRate * 0.02));
  const totalWindows = Math.floor(channel.length / windowSamples);
  const thresholdAmp = Math.pow(10, options.thresholdDb / 20);
  const minSilenceSec = options.minSilenceMs / 1000;
  const paddingSec = options.paddingMs / 1000;

  const rawSilences: SilenceRegion[] = [];
  let inSilence = false;
  let silenceStart = 0;

  for (let w = 0; w < totalWindows; w += 1) {
    const startIdx = w * windowSamples;
    const endIdx = Math.min(channel.length, startIdx + windowSamples);
    let sumSq = 0;
    const stride = Math.max(1, Math.floor((endIdx - startIdx) / 64));
    let count = 0;
    for (let i = startIdx; i < endIdx; i += stride) {
      const s = channel[i];
      sumSq += s * s;
      count += 1;
    }
    const rms = Math.sqrt(sumSq / Math.max(1, count));
    const timeSec = startIdx / sampleRate;

    if (rms < thresholdAmp) {
      if (!inSilence) {
        inSilence = true;
        silenceStart = timeSec;
      }
    } else if (inSilence) {
      inSilence = false;
      const paddedStart = silenceStart + paddingSec;
      const paddedEnd = timeSec - paddingSec;
      if (paddedEnd - paddedStart >= minSilenceSec) {
        rawSilences.push({
          start: Number(paddedStart.toFixed(3)),
          end: Number(paddedEnd.toFixed(3)),
          duration: Number((paddedEnd - paddedStart).toFixed(3)),
        });
      }
    }
  }

  if (inSilence) {
    const paddedStart = silenceStart + paddingSec;
    if (duration - paddedStart >= minSilenceSec) {
      rawSilences.push({
        start: Number(paddedStart.toFixed(3)),
        end: Number(duration.toFixed(3)),
        duration: Number((duration - paddedStart).toFixed(3)),
      });
    }
  }

  const bins = 160;
  const binSize = Math.max(1, Math.floor(channel.length / bins));
  const peaks: number[] = [];
  let maxPeak = 0.01;
  for (let b = 0; b < bins; b += 1) {
    const start = b * binSize;
    const end = Math.min(channel.length, start + binSize);
    const step = Math.max(1, Math.floor((end - start) / 48));
    let p = 0;
    for (let i = start; i < end; i += step) {
      const a = Math.abs(channel[i]);
      if (a > p) p = a;
    }
    if (p > maxPeak) maxPeak = p;
    peaks.push(p);
  }

  return {
    duration,
    peaks: peaks.map((p) => Number((p / maxPeak).toFixed(3))),
    silences: rawSilences,
  };
}
