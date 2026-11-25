export async function extractDownsampledWaveform(
  file: File,
  targetBins = 96
): Promise<number[]> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return fallbackPeaks(targetBins, file.size);

    const ctx = new AudioCtx();
    try {
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
      const channelData = audioBuffer.getChannelData(0);
      const total = channelData.length;
      const blockSize = Math.max(1, Math.floor(total / targetBins));
      const stride = Math.max(1, Math.floor(blockSize / 64));

      const peaks: number[] = [];
      let globalMax = 0.01;

      for (let i = 0; i < targetBins; i += 1) {
        const start = i * blockSize;
        const end = Math.min(total, start + blockSize);
        let max = 0;
        for (let j = start; j < end; j += stride) {
          const v = Math.abs(channelData[j]);
          if (v > max) max = v;
        }
        if (max > globalMax) globalMax = max;
        peaks.push(max);
      }

      return peaks.map((p) => Number((p / globalMax).toFixed(3)));
    } finally {
      await ctx.close();
    }
  } catch {
    return fallbackPeaks(targetBins, file.size);
  }
}

function fallbackPeaks(bins: number, seed: number): number[] {
  const peaks: number[] = [];
  for (let i = 0; i < bins; i += 1) {
    peaks.push(Number((0.2 + Math.abs(Math.sin(i * 0.42 + seed * 0.01)) * 0.72).toFixed(3)));
  }
  return peaks;
}
