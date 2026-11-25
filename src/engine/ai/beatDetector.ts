import { BeatMarker } from '../../types/ai';
import { uid } from '../../utils/timecode';

export interface BeatDetectionResult {
  bpm: number;
  beats: BeatMarker[];
}

export function detectBeatsFromBuffer(
  buffer: AudioBuffer,
  timelineOffset: number,
  sensitivity = 1.35
): BeatDetectionResult {
  const raw = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;

  const rc = 1 / (2 * Math.PI * 150);
  const dt = 1 / sampleRate;
  const alpha = dt / (rc + dt);

  const windowSize = Math.max(1, Math.floor(sampleRate * 0.025));
  const numWindows = Math.floor(raw.length / windowSize);
  const energies = new Float32Array(numWindows);

  let lp = 0;
  for (let w = 0; w < numWindows; w += 1) {
    const start = w * windowSize;
    const end = Math.min(raw.length, start + windowSize);
    let energy = 0;
    for (let i = start; i < end; i += 2) {
      lp = lp + alpha * (raw[i] - lp);
      energy += lp * lp;
    }
    energies[w] = energy / Math.max(1, (end - start) / 2);
  }

  const localSpan = 20;
  const minPeakGapSec = 0.28;
  const detectedTimes: { time: number; strength: number }[] = [];
  let lastBeatTime = -1;

  for (let w = 2; w < numWindows - 2; w += 1) {
    let avg = 0;
    const s = Math.max(0, w - localSpan);
    const e = Math.min(numWindows, w + localSpan);
    for (let j = s; j < e; j += 1) avg += energies[j];
    avg /= Math.max(1, e - s);

    const val = energies[w];
    const isLocalMax =
      val > energies[w - 1] &&
      val >= energies[w + 1] &&
      val > avg * sensitivity &&
      val > 0.0002;

    if (isLocalMax) {
      const t = (w * windowSize) / sampleRate;
      if (t - lastBeatTime >= minPeakGapSec) {
        detectedTimes.push({
          time: Number((timelineOffset + t).toFixed(3)),
          strength: Math.min(1, Number((val / (avg * sensitivity * 1.8)).toFixed(2))),
        });
        lastBeatTime = t;
      }
    }
  }

  let bpm = 120;
  if (detectedTimes.length >= 3) {
    const intervals: number[] = [];
    for (let i = 1; i < detectedTimes.length; i += 1) {
      const diff = detectedTimes[i].time - detectedTimes[i - 1].time;
      if (diff >= 0.28 && diff <= 1.2) intervals.push(diff);
    }
    if (intervals.length > 0) {
      intervals.sort((a, b) => a - b);
      const median = intervals[Math.floor(intervals.length / 2)];
      bpm = Math.round(60 / median);
      while (bpm < 70) bpm *= 2;
      while (bpm > 180) bpm = Math.round(bpm / 2);
    }
  }

  const beats: BeatMarker[] = detectedTimes.map((pt, idx) => {
    const isDownbeat = idx % 4 === 0;
    return {
      id: uid('beat'),
      time: pt.time,
      strength: pt.strength,
      label: isDownbeat ? `BEAT ${idx + 1}` : undefined,
      color: isDownbeat ? '#F59E0B' : '#06B6D4',
      isDownbeat,
    };
  });

  return { bpm, beats };
}
