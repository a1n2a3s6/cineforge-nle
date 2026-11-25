import React, { useRef, useState } from 'react';
import { Film, Image as ImageIcon, Music, Plus, Sparkles, Upload } from 'lucide-react';
import { extractDownsampledWaveform } from '../../engine/audio/WaveformEngine';
import { useProjectStore } from '../../store/projectStore';
import { MediaAsset, MediaAssetKind } from '../../types/timeline';
import { formatShortTime, uid } from '../../utils/timecode';

function classifyFile(file: File): MediaAssetKind | null {
  const mime = file.type.toLowerCase();
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (mime.startsWith('video/') || ['mp4', 'webm', 'mov'].includes(ext)) return 'video';
  if (mime.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) return 'audio';
  if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp'].includes(ext)) return 'image';
  return null;
}

async function extractMediaMetadata(file: File, kind: MediaAssetKind): Promise<MediaAsset> {
  const url = URL.createObjectURL(file);

  if (kind === 'image') {
    const dims = await new Promise<{ w: number; h: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve({ w: 1920, h: 1080 });
      img.src = url;
    });
    return {
      id: uid('asset'),
      name: file.name,
      kind,
      mimeType: file.type || 'image/png',
      url,
      duration: 5,
      width: dims.w,
      height: dims.h,
      fps: 30,
      fileSize: file.size,
      thumbnailUrl: url,
      createdAt: Date.now(),
    };
  }

  if (kind === 'audio') {
    const duration = await new Promise<number>((resolve) => {
      const audio = document.createElement('audio');
      audio.preload = 'metadata';
      audio.onloadedmetadata = () => resolve(Number.isFinite(audio.duration) ? audio.duration : 10);
      audio.onerror = () => resolve(10);
      audio.src = url;
    });
    const peaks = await extractDownsampledWaveform(file, 96);
    return {
      id: uid('asset'),
      name: file.name,
      kind,
      mimeType: file.type || 'audio/mpeg',
      url,
      duration,
      width: 0,
      height: 0,
      fps: 0,
      fileSize: file.size,
      waveformPeaks: peaks,
      createdAt: Date.now(),
    };
  }

  const meta = await new Promise<{ duration: number; w: number; h: number; thumb?: string }>(
    (resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;

      video.onloadeddata = () => {
        video.currentTime = Math.min(0.5, (video.duration || 1) * 0.1);
      };

      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 160;
        canvas.height = 90;
        const ctx = canvas.getContext('2d');
        let thumb: string | undefined;
        if (ctx) {
          ctx.drawImage(video, 0, 0, 160, 90);
          thumb = canvas.toDataURL('image/jpeg', 0.65);
        }
        resolve({
          duration: Number.isFinite(video.duration) ? video.duration : 8,
          w: video.videoWidth || 1920,
          h: video.videoHeight || 1080,
          thumb,
        });
      };

      video.onerror = () => resolve({ duration: 8, w: 1920, h: 1080 });
      video.src = url;
    }
  );

  return {
    id: uid('asset'),
    name: file.name,
    kind,
    mimeType: file.type || 'video/mp4',
    url,
    duration: meta.duration,
    width: meta.w,
    height: meta.h,
    fps: 30,
    fileSize: file.size,
    thumbnailUrl: meta.thumb,
    createdAt: Date.now(),
  };
}

export const MediaBin: React.FC = () => {
  const assets = useProjectStore((s) => s.assets);
  const addMediaAsset = useProjectStore((s) => s.addMediaAsset);
  const addAssetToTimeline = useProjectStore((s) => s.addAssetToTimeline);
  const loadSyntheticDemo = useProjectStore((s) => s.loadSyntheticDemo);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [ingesting, setIngesting] = useState(false);

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setIngesting(true);
    try {
      for (const file of Array.from(fileList)) {
        const kind = classifyFile(file);
        if (!kind) continue;
        const asset = await extractMediaMetadata(file, kind);
        addMediaAsset(asset);
      }
    } finally {
      setIngesting(false);
    }
  };

  return (
    <aside className="w-64 shrink-0 bg-[#111318] border-r border-[#222631] flex flex-col h-full">
      <div className="h-9 px-3 border-b border-[#222631] flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-300">
          Media Bin ({assets.length})
        </span>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium bg-[#171A21] hover:bg-[#222631] text-zinc-200 border border-[#222631] rounded transition-colors"
        >
          <Upload className="w-3 h-3 text-cyan-400" />
          Import
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="video/mp4,video/webm,audio/mpeg,audio/wav,image/png,image/jpeg"
          className="hidden"
          onChange={(e) => {
            void handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      <div className="p-2 border-b border-[#222631] bg-[#0D0F14]">
        <button
          type="button"
          onClick={loadSyntheticDemo}
          className="w-full py-2 px-2 rounded border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>Load Synthetic Demo Project</span>
        </button>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          void handleFiles(e.dataTransfer.files);
        }}
        className={`flex-1 overflow-y-auto p-2 space-y-2 transition-colors ${
          isDragOver ? 'bg-cyan-500/10 ring-1 ring-inset ring-cyan-500/60' : ''
        }`}
      >
        {ingesting && (
          <div className="text-[11px] font-mono text-cyan-400 px-2 py-1 bg-[#171A21] border border-[#222631] rounded">
            Indexing local media...
          </div>
        )}

        {assets.length === 0 ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="h-44 border border-dashed border-[#2A303E] hover:border-cyan-500/60 rounded flex flex-col items-center justify-center text-center p-4 cursor-pointer transition-colors"
          >
            <Upload className="w-6 h-6 text-zinc-500 mb-2" />
            <p className="text-xs font-medium text-zinc-300">Drop MP4, WebM, MP3, WAV, PNG, JPG</p>
            <p className="text-[11px] text-zinc-500 mt-1">
              Or click Synthetic Demo above for instant multi-track editing.
            </p>
          </div>
        ) : (
          assets.map((asset) => (
            <div
              key={asset.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('application/x-cineforge-asset', asset.id);
              }}
              className="group bg-[#171A21] hover:bg-[#1D212B] border border-[#222631] rounded p-1.5 flex items-center gap-2 cursor-grab active:cursor-grabbing"
            >
              <div className="w-14 h-9 shrink-0 rounded bg-[#0A0B0E] border border-[#222631] overflow-hidden flex items-center justify-center relative">
                {asset.thumbnailUrl ? (
                  <img
                    src={asset.thumbnailUrl}
                    alt={asset.name}
                    className="w-full h-full object-cover"
                  />
                ) : asset.kind === 'audio' ? (
                  <Music className="w-4 h-4 text-emerald-400" />
                ) : asset.kind === 'image' ? (
                  <ImageIcon className="w-4 h-4 text-amber-400" />
                ) : (
                  <Film className="w-4 h-4 text-cyan-400" />
                )}
                <span className="absolute bottom-0.5 right-0.5 bg-black/80 text-[8px] font-mono px-1 rounded text-zinc-200">
                  {formatShortTime(asset.duration)}
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-zinc-200 truncate" title={asset.name}>
                  {asset.name}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5 text-[9px] font-mono text-zinc-400 uppercase">
                  <span
                    className={
                      asset.kind === 'audio'
                        ? 'text-emerald-400'
                        : asset.kind === 'synthetic'
                          ? 'text-amber-400'
                          : 'text-cyan-400'
                    }
                  >
                    {asset.kind}
                  </span>
                  {asset.width > 0 && (
                    <span>
                      {asset.width}x{asset.height}
                    </span>
                  )}
                </div>
              </div>

              <button
                type="button"
                title="Add to Timeline"
                onClick={() => addAssetToTimeline(asset.id)}
                className="p-1 rounded bg-[#0A0B0E] hover:bg-amber-500 hover:text-black text-zinc-400 border border-[#222631] transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </aside>
  );
};
