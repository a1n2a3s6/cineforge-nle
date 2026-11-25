import { create } from 'zustand';
import { VIRAL_CAPTION_PRESETS } from '../engine/ai/captionEngine';
import { BeatMarker, CaptionPresetId, CaptionSegment } from '../types/ai';
import {
  AnimatableProperty,
  ChromaKeyParams,
  ClipTransform,
  ClipTransition,
  ColorGradeParams,
  DEFAULT_CHROMA_KEY,
  DEFAULT_COLOR_GRADE,
  DEFAULT_GPU_FX,
  DEFAULT_TRANSFORM,
  EasingType,
  GpuFxParams,
  TransitionType,
} from '../types/effects';
import {
  AspectRatioPreset,
  MediaAsset,
  ProjectSnapshot,
  ProxyQuality,
  SerializedProject,
  TelemetryStats,
  TimelineClip,
  TimelineTrack,
  ToolMode,
  TrackType,
} from '../types/timeline';
import { buildSyntheticDemoProject } from '../utils/syntheticMedia';
import { clamp, uid } from '../utils/timecode';
import { listProjectsInVault, saveProjectToVault } from './indexedDbVault';

const MAX_HISTORY = 50;
const MIN_CLIP_DURATION = 0.1;

function cloneSnapshot(snapshot: ProjectSnapshot): ProjectSnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as ProjectSnapshot;
}

function createInitialTracks(): TimelineTrack[] {
  return [
    { id: 'track_t1', name: 'T1', type: 'text', index: 0, height: 48, muted: false, solo: false, locked: false, visible: true, volume: 1, pan: 0, eqLow: 0, eqMid: 0, eqHigh: 0, compressorEnabled: false },
    { id: 'track_v2', name: 'V2', type: 'video', index: 1, height: 56, muted: false, solo: false, locked: false, visible: true, volume: 1, pan: 0, eqLow: 0, eqMid: 0, eqHigh: 0, compressorEnabled: false },
    { id: 'track_v1', name: 'V1', type: 'video', index: 2, height: 64, muted: false, solo: false, locked: false, visible: true, volume: 1, pan: 0, eqLow: 0, eqMid: 0, eqHigh: 0, compressorEnabled: false },
    { id: 'track_a1', name: 'A1', type: 'audio', index: 3, height: 56, muted: false, solo: false, locked: false, visible: true, volume: 1, pan: 0, eqLow: 0, eqMid: 0, eqHigh: 0, compressorEnabled: false },
    { id: 'track_a2', name: 'A2', type: 'audio', index: 4, height: 52, muted: false, solo: false, locked: false, visible: true, volume: 1, pan: 0, eqLow: 0, eqMid: 0, eqHigh: 0, compressorEnabled: false },
  ];
}

function createSnapshotFromState(state: {
  tracks: TimelineTrack[];
  clips: TimelineClip[];
  beatMarkers: BeatMarker[];
  captions: CaptionSegment[];
}): ProjectSnapshot {
  return cloneSnapshot({
    tracks: state.tracks,
    clips: state.clips,
    beatMarkers: state.beatMarkers,
    captions: state.captions,
  });
}

export interface ProjectStore {
  projectId: string;
  projectName: string;
  fps: number;
  aspectRatio: AspectRatioPreset;
  proxyQuality: ProxyQuality;

  tracks: TimelineTrack[];
  clips: TimelineClip[];
  assets: MediaAsset[];
  beatMarkers: BeatMarker[];
  captions: CaptionSegment[];

  playhead: number;
  isPlaying: boolean;
  shuttleRate: number;
  zoom: number;
  snapEnabled: boolean;
  activeTool: ToolMode;
  selectedClipIds: string[];
  lastSavedAt: number | null;
  vaultStatus: string;
  telemetry: TelemetryStats;

  past: ProjectSnapshot[];
  future: ProjectSnapshot[];

  setProjectName: (name: string) => void;
  setAspectRatio: (ratio: AspectRatioPreset) => void;
  setProxyQuality: (quality: ProxyQuality) => void;
  setPlayhead: (time: number) => void;
  setIsPlaying: (playing: boolean) => void;
  togglePlay: () => void;
  shuttle: (direction: 'reverse' | 'stop' | 'forward') => void;
  setZoom: (zoom: number) => void;
  toggleSnap: () => void;
  setActiveTool: (tool: ToolMode) => void;
  selectClip: (clipId: string | null, additive?: boolean) => void;
  setTelemetry: (stats: TelemetryStats) => void;

  addMediaAsset: (asset: MediaAsset) => void;
  addAssetToTimeline: (assetId: string, trackId?: string, startTime?: number) => void;
  loadSyntheticDemo: () => void;

  addTrack: (type: TrackType) => void;
  deleteTrack: (trackId: string) => void;
  toggleTrackFlag: (
    trackId: string,
    flag: 'muted' | 'solo' | 'locked' | 'visible' | 'compressorEnabled'
  ) => void;
  updateTrackAudio: (
    trackId: string,
    patch: Partial<
      Pick<TimelineTrack, 'volume' | 'pan' | 'eqLow' | 'eqMid' | 'eqHigh' | 'compressorEnabled'>
    >
  ) => void;

  commitSnapshot: () => void;
  moveClip: (
    clipId: string,
    targetTrackId: string,
    newStartTime: number,
    recordHistory?: boolean
  ) => void;
  trimClip: (
    clipId: string,
    edge: 'left' | 'right',
    newTime: number,
    recordHistory?: boolean
  ) => void;
  splitClipAtTime: (clipId: string, splitTime: number) => void;
  deleteSelectedClips: (ripple?: boolean) => void;

  updateClipTransform: (
    clipId: string,
    patch: Partial<ClipTransform>,
    recordHistory?: boolean
  ) => void;
  updateClipColorGrade: (
    clipId: string,
    patch: Partial<ColorGradeParams>,
    recordHistory?: boolean
  ) => void;
  resetClipColorGrade: (clipId: string) => void;
  updateClipChromaKey: (
    clipId: string,
    patch: Partial<ChromaKeyParams>,
    recordHistory?: boolean
  ) => void;
  updateClipGpuFx: (
    clipId: string,
    patch: Partial<GpuFxParams>,
    recordHistory?: boolean
  ) => void;
  toggleClipKeyframe: (
    clipId: string,
    property: AnimatableProperty,
    localTime: number,
    value: number,
    easing: EasingType
  ) => void;
  setClipTransition: (
    clipId: string,
    edge: 'in' | 'out',
    type: TransitionType | null,
    duration?: number
  ) => void;

  applySilenceCuts: (clipId: string, silences: { start: number; end: number }[]) => void;
  setBeatMarkers: (markers: BeatMarker[]) => void;
  autoCutVideoToBeats: () => void;
  addCaption: (segment: CaptionSegment) => void;
  setCaptions: (segments: CaptionSegment[]) => void;
  deleteCaption: (captionId: string) => void;
  updateAllCaptionsPreset: (presetId: CaptionPresetId) => void;

  undo: () => void;
  redo: () => void;
  saveToVault: () => Promise<void>;
  restoreLatestFromVault: () => Promise<boolean>;
}

export const useProjectStore = create<ProjectStore>()((set, get) => ({
  projectId: 'cineforge_default_project',
  projectName: 'Untitled Broadcast Sequence',
  fps: 30,
  aspectRatio: '16:9',
  proxyQuality: '0.5',

  tracks: createInitialTracks(),
  clips: [],
  assets: [],
  beatMarkers: [],
  captions: [],

  playhead: 0,
  isPlaying: false,
  shuttleRate: 1,
  zoom: 72,
  snapEnabled: true,
  activeTool: 'select',
  selectedClipIds: [],
  lastSavedAt: null,
  vaultStatus: 'Ready',
  telemetry: {
    fps: 0,
    frameTimeMs: 0,
    renderWidth: 960,
    renderHeight: 540,
    heapUsedMb: null,
    heapLimitMb: null,
    rendererBackend: 'WebGL2',
  },

  past: [],
  future: [],

  setProjectName: (name) => set({ projectName: name }),
  setAspectRatio: (aspectRatio) => set({ aspectRatio }),
  setProxyQuality: (proxyQuality) => set({ proxyQuality }),
  setPlayhead: (time) => set({ playhead: Math.max(0, time) }),
  setIsPlaying: (isPlaying) => set({ isPlaying, shuttleRate: isPlaying ? 1 : 0 }),

  togglePlay: () =>
    set((s) => ({
      isPlaying: !s.isPlaying,
      shuttleRate: !s.isPlaying ? 1 : 0,
    })),

  shuttle: (direction) =>
    set((s) => {
      if (direction === 'stop') return { isPlaying: false, shuttleRate: 0 };
      if (direction === 'forward') {
        const nextRate = s.isPlaying && s.shuttleRate >= 1 ? Math.min(4, s.shuttleRate * 2) : 1;
        return { isPlaying: true, shuttleRate: nextRate };
      }
      const nextRate = s.isPlaying && s.shuttleRate <= -1 ? Math.max(-4, s.shuttleRate * 2) : -1;
      return { isPlaying: true, shuttleRate: nextRate };
    }),

  setZoom: (zoom) => set({ zoom: clamp(zoom, 18, 260) }),
  toggleSnap: () => set((s) => ({ snapEnabled: !s.snapEnabled })),
  setActiveTool: (activeTool) => set({ activeTool }),

  selectClip: (clipId, additive = false) =>
    set((s) => {
      if (!clipId) return { selectedClipIds: [] };
      if (!additive) return { selectedClipIds: [clipId] };
      const exists = s.selectedClipIds.includes(clipId);
      return {
        selectedClipIds: exists
          ? s.selectedClipIds.filter((id) => id !== clipId)
          : [...s.selectedClipIds, clipId],
      };
    }),

  setTelemetry: (telemetry) => set({ telemetry }),

  commitSnapshot: () =>
    set((s) => {
      const snap = createSnapshotFromState(s);
      return { past: [...s.past, snap].slice(-MAX_HISTORY), future: [] };
    }),

  addMediaAsset: (asset) => set((s) => ({ assets: [asset, ...s.assets] })),

  addAssetToTimeline: (assetId, targetTrackId, startTime) => {
    const state = get();
    const asset = state.assets.find((a) => a.id === assetId);
    if (!asset) return;

    const desiredType: TrackType = asset.kind === 'audio' ? 'audio' : 'video';
    const track =
      state.tracks.find((t) => t.id === targetTrackId && t.type === desiredType && !t.locked) ??
      state.tracks.find((t) => t.type === desiredType && !t.locked);
    if (!track) return;

    const existingOnTrack = state.clips.filter((c) => c.trackId === track.id);
    const defaultStart =
      startTime !== undefined
        ? Math.max(0, startTime)
        : existingOnTrack.reduce((max, c) => Math.max(max, c.startTime + c.duration), 0);

    const newClip: TimelineClip = {
      id: uid('clip'),
      trackId: track.id,
      assetId: asset.id,
      name: asset.name,
      kind: desiredType,
      startTime: defaultStart,
      duration: Math.max(MIN_CLIP_DURATION, asset.duration),
      trimIn: 0,
      trimOut: Math.max(MIN_CLIP_DURATION, asset.duration),
      sourceDuration: Math.max(MIN_CLIP_DURATION, asset.duration),
      speed: 1,
      volume: 1,
      muted: false,
      locked: false,
      colorTag: desiredType === 'audio' ? '#10B981' : '#06B6D4',
      transform: { ...DEFAULT_TRANSFORM },
      colorGrade: { ...DEFAULT_COLOR_GRADE },
      chromaKey: { ...DEFAULT_CHROMA_KEY },
      gpuFx: { ...DEFAULT_GPU_FX },
      keyframes: {},
      transitions: [],
      effects: [],
    };

    state.commitSnapshot();
    set((s) => ({
      clips: [...s.clips, newClip],
      selectedClipIds: [newClip.id],
    }));
  },

  loadSyntheticDemo: () => {
    const state = get();
    // Revoke previous synthetic blob URLs to prevent memory leaks on 4-8GB RAM laptops
    state.assets.forEach((a) => {
      if (a.url.startsWith('blob:')) URL.revokeObjectURL(a.url);
    });
    state.commitSnapshot();
    const demo = buildSyntheticDemoProject();
    set({
      projectName: 'CineForge_Synthetic_Broadcast_Demo',
      assets: demo.assets,
      tracks: demo.snapshot.tracks,
      clips: demo.snapshot.clips,
      beatMarkers: demo.snapshot.beatMarkers,
      captions: demo.snapshot.captions,
      playhead: 0,
      isPlaying: false,
      selectedClipIds: demo.snapshot.clips[0] ? [demo.snapshot.clips[0].id] : [],
      vaultStatus: 'Synthetic Demo Loaded',
    });
  },

  addTrack: (type) => {
    const state = get();
    state.commitSnapshot();
    const prefix = type === 'video' ? 'V' : type === 'audio' ? 'A' : type === 'text' ? 'T' : 'ADJ';
    const count = state.tracks.filter((t) => t.type === type).length + 1;
    const newTrack: TimelineTrack = {
      id: uid(`track_${prefix.toLowerCase()}`),
      name: `${prefix}${count}`,
      type,
      index: state.tracks.length,
      height: type === 'text' ? 48 : 58,
      muted: false,
      solo: false,
      locked: false,
      visible: true,
      volume: 1,
      pan: 0,
      eqLow: 0,
      eqMid: 0,
      eqHigh: 0,
      compressorEnabled: false,
    };

    set((s) => {
      const next = [...s.tracks];
      if (type === 'audio') next.push(newTrack);
      else next.unshift(newTrack);
      return { tracks: next.map((t, idx) => ({ ...t, index: idx })) };
    });
  },

  deleteTrack: (trackId) => {
    const state = get();
    const target = state.tracks.find((t) => t.id === trackId);
    if (!target) return;
    if (state.tracks.filter((t) => t.type === target.type).length <= 1) return;

    state.commitSnapshot();
    set((s) => ({
      tracks: s.tracks.filter((t) => t.id !== trackId).map((t, idx) => ({ ...t, index: idx })),
      clips: s.clips.filter((c) => c.trackId !== trackId),
    }));
  },

  toggleTrackFlag: (trackId, flag) => {
    const state = get();
    state.commitSnapshot();
    set((s) => ({
      tracks: s.tracks.map((t) => (t.id === trackId ? { ...t, [flag]: !t[flag] } : t)),
    }));
  },

  updateTrackAudio: (trackId, patch) =>
    set((s) => ({
      tracks: s.tracks.map((t) => (t.id === trackId ? { ...t, ...patch } : t)),
    })),

  moveClip: (clipId, targetTrackId, newStartTime, recordHistory = false) => {
    const state = get();
    const clip = state.clips.find((c) => c.id === clipId);
    const targetTrack = state.tracks.find((t) => t.id === targetTrackId);
    if (!clip || !targetTrack || targetTrack.locked || clip.locked) return;
    if (targetTrack.type !== clip.kind) return;
    if (recordHistory) state.commitSnapshot();

    set((s) => ({
      clips: s.clips.map((c) =>
        c.id === clipId ? { ...c, trackId: targetTrackId, startTime: Math.max(0, newStartTime) } : c
      ),
    }));
  },

  trimClip: (clipId, edge, newTime, recordHistory = false) => {
    const state = get();
    const clip = state.clips.find((c) => c.id === clipId);
    if (!clip || clip.locked) return;
    const track = state.tracks.find((t) => t.id === clip.trackId);
    if (track?.locked) return;
    if (recordHistory) state.commitSnapshot();

    set((s) => ({
      clips: s.clips.map((c) => {
        if (c.id !== clipId) return c;
        const endTime = c.startTime + c.duration;
        if (edge === 'left') {
          const clampedStart = clamp(newTime, 0, endTime - MIN_CLIP_DURATION);
          const delta = clampedStart - c.startTime;
          const nextTrimIn = Math.max(0, c.trimIn + delta * c.speed);
          const actualDelta = (nextTrimIn - c.trimIn) / c.speed;
          return {
            ...c,
            startTime: c.startTime + actualDelta,
            duration: Math.max(MIN_CLIP_DURATION, c.duration - actualDelta),
            trimIn: nextTrimIn,
          };
        }
        const maxTimelineDur =
          c.kind === 'text' || c.kind === 'adjustment'
            ? 300
            : (c.sourceDuration - c.trimIn) / c.speed;
        const nextDur = clamp(
          newTime - c.startTime,
          MIN_CLIP_DURATION,
          Math.max(MIN_CLIP_DURATION, maxTimelineDur)
        );
        return { ...c, duration: nextDur, trimOut: c.trimIn + nextDur * c.speed };
      }),
    }));
  },

  splitClipAtTime: (clipId, splitTime) => {
    const state = get();
    const clip = state.clips.find((c) => c.id === clipId);
    if (!clip || clip.locked) return;
    const track = state.tracks.find((t) => t.id === clip.trackId);
    if (track?.locked) return;

    const offset = splitTime - clip.startTime;
    if (offset <= MIN_CLIP_DURATION || offset >= clip.duration - MIN_CLIP_DURATION) return;

    state.commitSnapshot();
    const leftClip: TimelineClip = {
      ...clip,
      duration: offset,
      trimOut: clip.trimIn + offset * clip.speed,
    };
    const rightClip: TimelineClip = {
      ...(JSON.parse(JSON.stringify(clip)) as TimelineClip),
      id: uid('clip'),
      startTime: splitTime,
      duration: clip.duration - offset,
      trimIn: clip.trimIn + offset * clip.speed,
      trimOut: clip.trimOut,
    };

    set((s) => ({
      clips: s.clips.flatMap((c) => (c.id === clipId ? [leftClip, rightClip] : [c])),
      selectedClipIds: [rightClip.id],
    }));
  },

  deleteSelectedClips: (ripple = false) => {
    const state = get();
    if (state.selectedClipIds.length === 0) return;

    const deletable = state.clips.filter((c) => {
      if (!state.selectedClipIds.includes(c.id)) return false;
      const track = state.tracks.find((t) => t.id === c.trackId);
      return !c.locked && !track?.locked;
    });
    if (deletable.length === 0) return;

    state.commitSnapshot();
    const deletableIds = new Set(deletable.map((c) => c.id));
    let remaining = state.clips.filter((c) => !deletableIds.has(c.id));

    if (ripple) {
      const byTrack = new Map<string, TimelineClip[]>();
      deletable.forEach((c) => {
        const list = byTrack.get(c.trackId) ?? [];
        list.push(c);
        byTrack.set(c.trackId, list);
      });
      byTrack.forEach((removedClips, trackId) => {
        removedClips.sort((a, b) => b.startTime - a.startTime);
        removedClips.forEach((removed) => {
          remaining = remaining.map((c) =>
            c.trackId === trackId && c.startTime >= removed.startTime
              ? { ...c, startTime: Math.max(0, c.startTime - removed.duration) }
              : c
          );
        });
      });
    }

    set({ clips: remaining, selectedClipIds: [] });
  },

  updateClipTransform: (clipId, patch, recordHistory = false) => {
    if (recordHistory) get().commitSnapshot();
    set((s) => ({
      clips: s.clips.map((c) =>
        c.id === clipId ? { ...c, transform: { ...c.transform, ...patch } } : c
      ),
    }));
  },

  updateClipColorGrade: (clipId, patch, recordHistory = false) => {
    if (recordHistory) get().commitSnapshot();
    set((s) => ({
      clips: s.clips.map((c) =>
        c.id === clipId ? { ...c, colorGrade: { ...c.colorGrade, ...patch } } : c
      ),
    }));
  },

  resetClipColorGrade: (clipId) => {
    get().commitSnapshot();
    set((s) => ({
      clips: s.clips.map((c) =>
        c.id === clipId ? { ...c, colorGrade: { ...DEFAULT_COLOR_GRADE } } : c
      ),
    }));
  },

  updateClipChromaKey: (clipId, patch, recordHistory = false) => {
    if (recordHistory) get().commitSnapshot();
    set((s) => ({
      clips: s.clips.map((c) =>
        c.id === clipId ? { ...c, chromaKey: { ...c.chromaKey, ...patch } } : c
      ),
    }));
  },

  updateClipGpuFx: (clipId, patch, recordHistory = false) => {
    if (recordHistory) get().commitSnapshot();
    set((s) => ({
      clips: s.clips.map((c) =>
        c.id === clipId ? { ...c, gpuFx: { ...c.gpuFx, ...patch } } : c
      ),
    }));
  },

  toggleClipKeyframe: (clipId, property, localTime, value, easing) => {
    const state = get();
    state.commitSnapshot();
    const clampedTime = Math.max(0, Number(localTime.toFixed(2)));

    set((s) => ({
      clips: s.clips.map((c) => {
        if (c.id !== clipId) return c;
        const existing = c.keyframes[property] ?? [];
        const nearIdx = existing.findIndex((k) => Math.abs(k.time - clampedTime) <= 0.08);
        const nextList =
          nearIdx >= 0
            ? existing.filter((_, idx) => idx !== nearIdx)
            : [...existing, { id: uid('kf'), time: clampedTime, value, easing }].sort(
                (a, b) => a.time - b.time
              );
        return {
          ...c,
          keyframes: {
            ...c.keyframes,
            [property]: nextList,
          },
        };
      }),
    }));
  },

  setClipTransition: (clipId, edge, type, duration = 0.6) => {
    get().commitSnapshot();
    set((s) => ({
      clips: s.clips.map((c) => {
        if (c.id !== clipId) return c;
        const filtered = c.transitions.filter((t) => t.edge !== edge);
        if (!type) return { ...c, transitions: filtered };
        const nextTransition: ClipTransition = {
          id: uid('tr'),
          type,
          duration,
          edge,
        };
        return { ...c, transitions: [...filtered, nextTransition] };
      }),
    }));
  },

  applySilenceCuts: (clipId, silences) => {
    const state = get();
    const clip = state.clips.find((c) => c.id === clipId);
    if (!clip || silences.length === 0) return;

    state.commitSnapshot();

    const sorted = [...silences].sort((a, b) => a.start - b.start);
    const kept: { inPt: number; outPt: number }[] = [];
    let cursor = clip.trimIn;
    const clipSourceEnd = clip.trimIn + clip.duration * clip.speed;

    for (const s of sorted) {
      if (s.end <= cursor || s.start >= clipSourceEnd) continue;
      if (s.start > cursor + 0.08) {
        kept.push({ inPt: cursor, outPt: Math.min(s.start, clipSourceEnd) });
      }
      cursor = Math.max(cursor, s.end);
    }
    if (clipSourceEnd > cursor + 0.08) {
      kept.push({ inPt: cursor, outPt: clipSourceEnd });
    }
    if (kept.length === 0) return;

    let nextTimelineCursor = clip.startTime;
    const replacementClips: TimelineClip[] = kept.map((seg, idx) => {
      const dur = (seg.outPt - seg.inPt) / clip.speed;
      const cloned: TimelineClip = {
        ...(JSON.parse(JSON.stringify(clip)) as TimelineClip),
        id: idx === 0 ? clip.id : uid('clip'),
        startTime: nextTimelineCursor,
        duration: dur,
        trimIn: seg.inPt,
        trimOut: seg.outPt,
      };
      nextTimelineCursor += dur;
      return cloned;
    });

    const totalRemoved = Math.max(0, clip.startTime + clip.duration - nextTimelineCursor);

    set((s) => ({
      clips: s.clips.flatMap((c) => {
        if (c.id === clipId) return replacementClips;
        if (c.trackId === clip.trackId && c.startTime >= clip.startTime + clip.duration) {
          return [{ ...c, startTime: Math.max(0, c.startTime - totalRemoved) }];
        }
        return [c];
      }),
      selectedClipIds: [replacementClips[0].id],
    }));
  },

  setBeatMarkers: (markers) => {
    get().commitSnapshot();
    set({ beatMarkers: markers });
  },

  autoCutVideoToBeats: () => {
    const state = get();
    const downbeats = state.beatMarkers.filter((b) => b.isDownbeat).map((b) => b.time);
    const cutPoints = downbeats.length >= 2 ? downbeats : state.beatMarkers.map((b) => b.time);
    if (cutPoints.length === 0) return;

    state.commitSnapshot();
    const videoTrackIds = new Set(
      state.tracks.filter((t) => t.type === 'video' && !t.locked).map((t) => t.id)
    );

    let nextClips = [...state.clips];
    for (const cutTime of cutPoints) {
      nextClips = nextClips.flatMap((c) => {
        if (!videoTrackIds.has(c.trackId) || c.locked) return [c];
        const offset = cutTime - c.startTime;
        if (offset <= 0.15 || offset >= c.duration - 0.15) return [c];
        const left: TimelineClip = {
          ...c,
          duration: offset,
          trimOut: c.trimIn + offset * c.speed,
        };
        const right: TimelineClip = {
          ...(JSON.parse(JSON.stringify(c)) as TimelineClip),
          id: uid('clip'),
          startTime: cutTime,
          duration: c.duration - offset,
          trimIn: c.trimIn + offset * c.speed,
        };
        return [left, right];
      });
    }

    set({ clips: nextClips });
  },

  addCaption: (segment) => {
    get().commitSnapshot();
    set((s) => ({ captions: [...s.captions, segment] }));
  },

  setCaptions: (segments) => {
    get().commitSnapshot();
    set({ captions: segments });
  },

  deleteCaption: (captionId) => {
    get().commitSnapshot();
    set((s) => ({ captions: s.captions.filter((c) => c.id !== captionId) }));
  },

  updateAllCaptionsPreset: (presetId) => {
    get().commitSnapshot();
    const preset = VIRAL_CAPTION_PRESETS[presetId].style;
    set((s) => ({
      captions: s.captions.map((c) => ({
        ...c,
        style: {
          ...preset,
          rtl: c.style.rtl,
          uppercase: c.style.rtl ? false : preset.uppercase,
        },
      })),
    }));
  },

  undo: () =>
    set((s) => {
      if (s.past.length === 0) return s;
      const previous = s.past[s.past.length - 1];
      const current = createSnapshotFromState(s);
      return {
        tracks: previous.tracks,
        clips: previous.clips,
        beatMarkers: previous.beatMarkers,
        captions: previous.captions,
        past: s.past.slice(0, -1),
        future: [current, ...s.future].slice(0, MAX_HISTORY),
        selectedClipIds: [],
      };
    }),

  redo: () =>
    set((s) => {
      if (s.future.length === 0) return s;
      const next = s.future[0];
      const current = createSnapshotFromState(s);
      return {
        tracks: next.tracks,
        clips: next.clips,
        beatMarkers: next.beatMarkers,
        captions: next.captions,
        past: [...s.past, current].slice(-MAX_HISTORY),
        future: s.future.slice(1),
        selectedClipIds: [],
      };
    }),

  saveToVault: async () => {
    const s = get();
    const payload: SerializedProject = {
      id: s.projectId,
      name: s.projectName,
      fps: s.fps,
      aspectRatio: s.aspectRatio,
      proxyQuality: s.proxyQuality,
      updatedAt: Date.now(),
      assets: s.assets,
      snapshot: createSnapshotFromState(s),
    };
    try {
      await saveProjectToVault(payload);
      set({ lastSavedAt: payload.updatedAt, vaultStatus: 'Saved to IndexedDB' });
    } catch {
      set({ vaultStatus: 'Vault Save Failed' });
    }
  },

  restoreLatestFromVault: async () => {
    try {
      const projects = await listProjectsInVault();
      if (projects.length === 0) return false;
      const latest = projects[0];
      set({
        projectId: latest.id,
        projectName: latest.name,
        fps: latest.fps,
        aspectRatio: latest.aspectRatio,
        proxyQuality: latest.proxyQuality,
        assets: latest.assets,
        tracks: latest.snapshot.tracks,
        clips: latest.snapshot.clips,
        beatMarkers: latest.snapshot.beatMarkers,
        captions: latest.snapshot.captions,
        lastSavedAt: latest.updatedAt,
        vaultStatus: 'Restored from Vault',
      });
      return true;
    } catch {
      return false;
    }
  },
}));
