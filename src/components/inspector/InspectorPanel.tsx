import React, { useState } from 'react';
import {
  Diamond,
  Palette,
  RotateCcw,
  Sliders,
  Sparkles,
  Subtitles,
  Volume2,
} from 'lucide-react';
import { hasKeyframeNearTime, solveClipTransform } from '../../engine/animation/keyframeSolver';
import { VISUAL_TRANSITION_PRESETS } from '../../engine/animation/transitions';
import { useProjectStore } from '../../store/projectStore';
import {
  AnimatableProperty,
  CINEMA_LUT_PRESETS,
  EasingType,
  TransitionType,
} from '../../types/effects';
import { RGBScopes } from '../viewport/RGBScopes';
import { AudioMixerPanel } from './AudioMixerPanel';
import { CaptionsPanel } from './CaptionsPanel';

type InspectorTab = 'transform' | 'color' | 'fx' | 'audio' | 'captions';

const EASING_OPTIONS: { value: EasingType; label: string }[] = [
  { value: 'linear', label: 'Linear' },
  { value: 'ease-in-out', label: 'EaseInOut' },
  { value: 'spring', label: 'Spring' },
];

export const InspectorPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<InspectorTab>('color');
  const [defaultEasing, setDefaultEasing] = useState<EasingType>('ease-in-out');

  const clips = useProjectStore((s) => s.clips);
  const selectedClipIds = useProjectStore((s) => s.selectedClipIds);
  const playhead = useProjectStore((s) => s.playhead);

  const updateClipTransform = useProjectStore((s) => s.updateClipTransform);
  const updateClipColorGrade = useProjectStore((s) => s.updateClipColorGrade);
  const resetClipColorGrade = useProjectStore((s) => s.resetClipColorGrade);
  const updateClipChromaKey = useProjectStore((s) => s.updateClipChromaKey);
  const updateClipGpuFx = useProjectStore((s) => s.updateClipGpuFx);
  const toggleClipKeyframe = useProjectStore((s) => s.toggleClipKeyframe);
  const setClipTransition = useProjectStore((s) => s.setClipTransition);

  const selectedClip = clips.find((c) => c.id === selectedClipIds[0]) ?? null;
  const clipLocalTime = selectedClip ? Math.max(0, playhead - selectedClip.startTime) : 0;
  const solvedTransform = selectedClip
    ? solveClipTransform(selectedClip.transform, selectedClip.keyframes, clipLocalTime)
    : null;

  const renderKeyframeButton = (prop: AnimatableProperty, currentVal: number) => {
    if (!selectedClip) return null;
    const activeKf = hasKeyframeNearTime(selectedClip.keyframes[prop], clipLocalTime);
    const hasAny = (selectedClip.keyframes[prop]?.length ?? 0) > 0;
    return (
      <button
        type="button"
        title={activeKf ? 'Remove Keyframe at Playhead' : 'Add Keyframe at Playhead'}
        onClick={() =>
          toggleClipKeyframe(selectedClip.id, prop, clipLocalTime, currentVal, defaultEasing)
        }
        className={`p-0.5 rounded transition-colors ${
          activeKf
            ? 'text-amber-400'
            : hasAny
              ? 'text-cyan-400 hover:text-amber-300'
              : 'text-zinc-600 hover:text-zinc-300'
        }`}
      >
        <Diamond className={`w-3 h-3 ${activeKf ? 'fill-amber-400' : ''}`} />
      </button>
    );
  };

  return (
    <aside className="w-80 shrink-0 bg-[#111318] border-l border-[#222631] flex flex-col h-full">
      <div className="h-9 grid grid-cols-5 border-b border-[#222631] bg-[#0E1015] shrink-0">
        {(
          [
            ['transform', 'Xform', Sliders],
            ['color', 'Color', Palette],
            ['fx', 'FX', Sparkles],
            ['audio', 'Mixer', Volume2],
            ['captions', 'Subs', Subtitles],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`flex items-center justify-center gap-1 text-[9px] font-semibold uppercase tracking-wide border-b-2 transition-colors ${
              activeTab === id
                ? 'border-amber-400 text-amber-300 bg-[#14171F]'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Icon className="w-3 h-3" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {activeTab === 'audio' ? (
          <AudioMixerPanel />
        ) : activeTab === 'captions' ? (
          <CaptionsPanel />
        ) : !selectedClip ? (
          <div className="h-40 border border-dashed border-[#222631] rounded flex items-center justify-center text-center p-4 text-xs text-zinc-500">
            Select a clip on the timeline to inspect Transform, Color Grading, Chroma Key, and FX.
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between pb-2 border-b border-[#222631]">
              <span className="text-xs font-semibold text-zinc-200 truncate" title={selectedClip.name}>
                {selectedClip.name}
              </span>
              <span className="text-[10px] font-mono text-zinc-500 uppercase">
                {selectedClip.kind}
              </span>
            </div>

            {activeTab === 'transform' && solvedTransform && (
              <div className="space-y-3">
                <div className="flex items-center justify-between bg-[#0A0B0E] border border-[#222631] rounded px-2 py-1.5">
                  <span className="text-[10px] font-mono uppercase text-zinc-400">Curve</span>
                  <div className="flex gap-1">
                    {EASING_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setDefaultEasing(opt.value)}
                        className={`px-1.5 py-0.5 text-[9px] font-mono rounded ${
                          defaultEasing === opt.value
                            ? 'bg-amber-500 text-black font-bold'
                            : 'text-zinc-400 hover:bg-[#222631]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {(
                  [
                    ['x', 'Position X', -1, 1, 0.01, solvedTransform.x],
                    ['y', 'Position Y', -1, 1, 0.01, solvedTransform.y],
                    ['scaleX', 'Scale X', 0.1, 3, 0.01, solvedTransform.scaleX],
                    ['scaleY', 'Scale Y', 0.1, 3, 0.01, solvedTransform.scaleY],
                    ['rotation', 'Rotation', -180, 180, 1, solvedTransform.rotation],
                    ['opacity', 'Opacity', 0, 1, 0.01, solvedTransform.opacity],
                  ] as [AnimatableProperty, string, number, number, number, number][]
                ).map(([prop, label, min, max, step, val]) => (
                  <div key={prop} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1.5">
                        {renderKeyframeButton(prop, val)}
                        <span className="text-zinc-300">{label}</span>
                      </div>
                      <span className="font-mono text-[10px] text-amber-300">
                        {prop === 'rotation' ? `${val.toFixed(0)}°` : val.toFixed(2)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={min}
                      max={max}
                      step={step}
                      value={val}
                      onChange={(e) => {
                        const next = Number(e.target.value);
                        updateClipTransform(selectedClip.id, { [prop]: next });
                        if ((selectedClip.keyframes[prop]?.length ?? 0) > 0) {
                          const existing = hasKeyframeNearTime(
                            selectedClip.keyframes[prop],
                            clipLocalTime
                          );
                          if (!existing) {
                            toggleClipKeyframe(
                              selectedClip.id,
                              prop,
                              clipLocalTime,
                              next,
                              defaultEasing
                            );
                          }
                        }
                      }}
                      className="nle-slider w-full"
                    />
                  </div>
                ))}

                <div className="pt-2 border-t border-[#222631] space-y-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400">
                    Clip Transitions
                  </span>
                  {(['in', 'out'] as const).map((edge) => {
                    const currentTr = selectedClip.transitions.find((t) => t.edge === edge);
                    return (
                      <div key={edge} className="flex items-center justify-between gap-2">
                        <span className="text-[11px] uppercase font-mono text-zinc-400 w-10">
                          {edge}
                        </span>
                        <select
                          value={currentTr?.type ?? ''}
                          onChange={(e) => {
                            const val = e.target.value as TransitionType | '';
                            setClipTransition(
                              selectedClip.id,
                              edge,
                              val === '' ? null : val,
                              0.6
                            );
                          }}
                          className="flex-1 bg-[#0A0B0E] border border-[#222631] rounded px-2 py-1 text-xs text-zinc-200 outline-none"
                        >
                          <option value="">None</option>
                          {VISUAL_TRANSITION_PRESETS.map((p) => (
                            <option key={p.type} value={p.type}>
                              {p.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === 'color' && (
              <div className="space-y-3">
                <RGBScopes />

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                      Cinema LUT Presets
                    </span>
                    <button
                      type="button"
                      onClick={() => resetClipColorGrade(selectedClip.id)}
                      className="text-[10px] text-zinc-400 hover:text-amber-300 flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" /> Reset
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {CINEMA_LUT_PRESETS.map((lut) => (
                      <button
                        key={lut.id}
                        type="button"
                        onClick={() =>
                          updateClipColorGrade(selectedClip.id, { lutId: lut.id }, true)
                        }
                        className={`px-2 py-1.5 rounded text-[11px] font-medium border text-left transition-colors ${
                          selectedClip.colorGrade.lutId === lut.id
                            ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                            : 'bg-[#0A0B0E] border-[#222631] text-zinc-300 hover:bg-[#171A21]'
                        }`}
                      >
                        {lut.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 pt-1">
                  {(
                    [
                      ['exposure', 'Exposure', -2, 2, 0.05],
                      ['contrast', 'Contrast', 0, 2, 0.02],
                      ['saturation', 'Saturation', 0, 2, 0.02],
                      ['temperature', 'Temperature', -100, 100, 1],
                      ['tint', 'Tint', -100, 100, 1],
                      ['highlights', 'Highlights', -100, 100, 1],
                      ['shadows', 'Shadows', -100, 100, 1],
                      ['vignette', 'Vignette', 0, 1, 0.02],
                      ['sharpen', 'Sharpen', 0, 1, 0.02],
                    ] as const
                  ).map(([key, label, min, max, step]) => (
                    <label key={key} className="block space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-zinc-300">{label}</span>
                        <span className="font-mono text-[10px] text-cyan-300">
                          {selectedClip.colorGrade[key].toFixed(step < 1 ? 2 : 0)}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={min}
                        max={max}
                        step={step}
                        value={selectedClip.colorGrade[key]}
                        onChange={(e) =>
                          updateClipColorGrade(selectedClip.id, {
                            [key]: Number(e.target.value),
                          })
                        }
                        className="nle-slider w-full"
                      />
                    </label>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'fx' && (
              <div className="space-y-4">
                <div className="bg-[#0A0B0E] border border-[#222631] rounded p-2.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-emerald-400">
                      GPU Chroma Key
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        updateClipChromaKey(
                          selectedClip.id,
                          { enabled: !selectedClip.chromaKey.enabled },
                          true
                        )
                      }
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        selectedClip.chromaKey.enabled
                          ? 'bg-emerald-500 text-black'
                          : 'bg-[#171A21] text-zinc-400 border border-[#222631]'
                      }`}
                    >
                      {selectedClip.chromaKey.enabled ? 'ACTIVE' : 'OFF'}
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-zinc-300">Key Color</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          updateClipChromaKey(selectedClip.id, { keyColor: '#00FF00' })
                        }
                        className="w-4 h-4 rounded-sm bg-[#00FF00] border border-white/30"
                        title="Green Screen"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          updateClipChromaKey(selectedClip.id, { keyColor: '#0044FF' })
                        }
                        className="w-4 h-4 rounded-sm bg-[#0044FF] border border-white/30"
                        title="Blue Screen"
                      />
                      <input
                        type="color"
                        value={selectedClip.chromaKey.keyColor}
                        onChange={(e) =>
                          updateClipChromaKey(selectedClip.id, { keyColor: e.target.value })
                        }
                        className="w-6 h-5 bg-transparent border-0 cursor-pointer"
                      />
                    </div>
                  </div>

                  {(
                    [
                      ['similarity', 'Similarity'],
                      ['smoothness', 'Smoothness'],
                      ['spill', 'Spill Suppress'],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="block space-y-1">
                      <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                        <span>{label}</span>
                        <span>{Math.round(selectedClip.chromaKey[key] * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={selectedClip.chromaKey[key]}
                        onChange={(e) =>
                          updateClipChromaKey(selectedClip.id, { [key]: Number(e.target.value) })
                        }
                        className="nle-slider w-full"
                      />
                    </label>
                  ))}
                </div>

                <div className="space-y-2.5">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400">
                    GPU Shader FX
                  </span>
                  {(
                    [
                      ['blur', 'Gaussian Blur'],
                      ['chromaticAberration', 'Chromatic Aberration'],
                      ['vhsGlitch', 'VHS Glitch'],
                      ['filmGrain', 'Film Grain'],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="block space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-zinc-300">{label}</span>
                        <span className="font-mono text-[10px] text-amber-300">
                          {Math.round(selectedClip.gpuFx[key] * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={selectedClip.gpuFx[key]}
                        onChange={(e) =>
                          updateClipGpuFx(selectedClip.id, { [key]: Number(e.target.value) })
                        }
                        className="nle-slider w-full"
                      />
                    </label>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
};
