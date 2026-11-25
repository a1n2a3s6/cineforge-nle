import { AnimatableProperty, ClipTransform, EasingType, Keyframe } from '../../types/effects';

export function evaluateEasing(t: number, easing: EasingType): number {
  const clamped = Math.max(0, Math.min(1, t));
  switch (easing) {
    case 'hold':
      return clamped < 1 ? 0 : 1;
    case 'ease-in':
      return clamped * clamped * clamped;
    case 'ease-out':
      return 1 - Math.pow(1 - clamped, 3);
    case 'ease-in-out':
      return clamped < 0.5
        ? 4 * clamped * clamped * clamped
        : 1 - Math.pow(-2 * clamped + 2, 3) / 2;
    case 'spring': {
      if (clamped === 0 || clamped === 1) return clamped;
      const decay = Math.exp(-6.5 * clamped);
      return 1 - decay * Math.cos(14 * clamped);
    }
    case 'linear':
    default:
      return clamped;
  }
}

export function solveKeyframedValue(
  keyframes: Keyframe<number>[] | undefined,
  localTime: number,
  fallbackValue: number
): number {
  if (!keyframes || keyframes.length === 0) return fallbackValue;

  const sorted = [...keyframes].sort((a, b) => a.time - b.time);
  if (localTime <= sorted[0].time) return sorted[0].value;
  if (localTime >= sorted[sorted.length - 1].time) return sorted[sorted.length - 1].value;

  for (let i = 0; i < sorted.length - 1; i += 1) {
    const k0 = sorted[i];
    const k1 = sorted[i + 1];
    if (localTime >= k0.time && localTime <= k1.time) {
      const span = Math.max(0.0001, k1.time - k0.time);
      const rawT = (localTime - k0.time) / span;
      const easedT = evaluateEasing(rawT, k0.easing);
      return k0.value + (k1.value - k0.value) * easedT;
    }
  }

  return fallbackValue;
}

export function solveClipTransform(
  base: ClipTransform,
  keyframes: Record<string, Keyframe<number>[]>,
  localTime: number
): ClipTransform {
  const props: AnimatableProperty[] = ['x', 'y', 'scaleX', 'scaleY', 'rotation', 'opacity'];
  const solved: ClipTransform = { ...base };

  props.forEach((prop) => {
    solved[prop] = solveKeyframedValue(keyframes[prop], localTime, base[prop]);
  });

  return solved;
}

export function hasKeyframeNearTime(
  keyframes: Keyframe<number>[] | undefined,
  localTime: number,
  tolerance = 0.08
): Keyframe<number> | null {
  if (!keyframes) return null;
  return keyframes.find((k) => Math.abs(k.time - localTime) <= tolerance) ?? null;
}
