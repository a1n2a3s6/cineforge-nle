import { ClipTransition, TransitionType } from '../../types/effects';

export interface TransitionPresetMeta {
  type: TransitionType;
  label: string;
  defaultDuration: number;
}

export const VISUAL_TRANSITION_PRESETS: TransitionPresetMeta[] = [
  { type: 'cross-dissolve', label: 'Cross Dissolve', defaultDuration: 0.6 },
  { type: 'dip-to-black', label: 'Dip to Black', defaultDuration: 0.7 },
  { type: 'whip-pan', label: 'Whip Pan', defaultDuration: 0.45 },
  { type: 'zoom-blur', label: 'Zoom Blur', defaultDuration: 0.5 },
  { type: 'glitch-cut', label: 'Glitch Cut', defaultDuration: 0.35 },
];

export interface TransitionRenderModifier {
  opacityMultiplier: number;
  dipBlack: number;
  offsetX: number;
  scaleMultiplier: number;
  extraBlur: number;
  extraChromatic: number;
  extraGlitch: number;
}

function smoothStep(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

export function evaluateClipTransitions(
  transitions: ClipTransition[],
  clipLocalTime: number,
  clipDuration: number
): TransitionRenderModifier {
  const mod: TransitionRenderModifier = {
    opacityMultiplier: 1,
    dipBlack: 0,
    offsetX: 0,
    scaleMultiplier: 1,
    extraBlur: 0,
    extraChromatic: 0,
    extraGlitch: 0,
  };

  for (const tr of transitions) {
    const dur = Math.min(tr.duration, clipDuration * 0.5);
    if (dur <= 0.01) continue;

    let amount = 0;
    let direction = 1;

    if (tr.edge === 'in' && clipLocalTime < dur) {
      amount = 1 - smoothStep(clipLocalTime / dur);
      direction = -1;
    } else if (tr.edge === 'out' && clipLocalTime > clipDuration - dur) {
      amount = smoothStep((clipLocalTime - (clipDuration - dur)) / dur);
      direction = 1;
    }

    if (amount <= 0.001) continue;

    switch (tr.type) {
      case 'cross-dissolve':
        mod.opacityMultiplier *= 1 - amount;
        break;
      case 'dip-to-black':
        mod.dipBlack = Math.max(mod.dipBlack, amount);
        break;
      case 'whip-pan':
        mod.offsetX += direction * amount * 1.15;
        mod.extraBlur = Math.max(mod.extraBlur, amount * 0.75);
        mod.extraChromatic = Math.max(mod.extraChromatic, amount * 0.45);
        break;
      case 'zoom-blur':
        mod.scaleMultiplier *= 1 + amount * 0.85;
        mod.extraBlur = Math.max(mod.extraBlur, amount * 0.9);
        mod.opacityMultiplier *= 1 - amount * 0.85;
        break;
      case 'glitch-cut':
        mod.extraGlitch = Math.max(mod.extraGlitch, amount);
        mod.extraChromatic = Math.max(mod.extraChromatic, amount * 0.95);
        mod.opacityMultiplier *= 1 - amount * 0.35;
        break;
      default:
        break;
    }
  }

  return mod;
}
