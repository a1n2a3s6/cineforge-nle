import React, { useRef, useState } from 'react';
import { Download, Mic, MicOff, Plus, Trash2, Upload } from 'lucide-react';
import {
  buildCaptionSegment,
  exportCaptionsToSrt,
  parseSrtOrVtt,
  VIRAL_CAPTION_PRESETS,
} from '../../engine/ai/captionEngine';
import { useProjectStore } from '../../store/projectStore';
import { CaptionPresetId } from '../../types/ai';

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export const CaptionsPanel: React.FC = () => {
  const captions = useProjectStore((s) => s.captions);
  const playhead = useProjectStore((s) => s.playhead);
  const addCaption = useProjectStore((s) => s.addCaption);
  const setCaptions = useProjectStore((s) => s.setCaptions);
  const deleteCaption = useProjectStore((s) => s.deleteCaption);
  const updateAllCaptionsPreset = useProjectStore((s) => s.updateAllCaptionsPreset);

  const [preset, setPreset] = useState<CaptionPresetId>('hormozi-pop');
  const [draftText, setDraftText] = useState('');
  const [dictationLang, setDictationLang] = useState<'en-US' | 'ar-SA'>('en-US');
  const [listening, setListening] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const srtInputRef = useRef<HTMLInputElement>(null);

  const toggleLiveSpeech = () => {
    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }

    const SpeechCtor =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike })
        .webkitSpeechRecognition;

    if (!SpeechCtor) {
      setDraftText('Web Speech API unavailable — type or import SRT below.');
      return;
    }

    const rec = new SpeechCtor();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = dictationLang;

    rec.onresult = (event) => {
      const last = event.results[event.results.length - 1];
      if (last?.isFinal && last[0]?.transcript) {
        const start = useProjectStore.getState().playhead;
        const seg = buildCaptionSegment(last[0].transcript, start, start + 3.2, preset);
        addCaption(seg);
      }
    };
    rec.onend = () => setListening(false);

    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  };

  const handleImportSrt = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    const parsed = parseSrtOrVtt(text, preset);
    if (parsed.length > 0) setCaptions(parsed);
  };

  const handleExportSrt = () => {
    const srt = exportCaptionsToSrt(captions);
    const blob = new Blob([srt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cineforge_captions.srt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <div>
        <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block mb-1.5">
          Viral Caption Style
        </span>
        <div className="grid grid-cols-2 gap-1.5">
          {(Object.keys(VIRAL_CAPTION_PRESETS) as CaptionPresetId[]).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setPreset(id);
                updateAllCaptionsPreset(id);
              }}
              className={`px-2 py-1.5 rounded text-[11px] font-medium border text-left transition-colors ${
                preset === id
                  ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                  : 'bg-[#0A0B0E] border-[#222631] text-zinc-300 hover:bg-[#171A21]'
              }`}
            >
              {VIRAL_CAPTION_PRESETS[id].label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-[#0A0B0E] border border-[#222631] rounded p-2 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <select
            value={dictationLang}
            onChange={(e) => setDictationLang(e.target.value as 'en-US' | 'ar-SA')}
            className="bg-[#171A21] border border-[#222631] rounded px-2 py-1 text-[11px] text-zinc-200 outline-none"
          >
            <option value="en-US">English (LTR)</option>
            <option value="ar-SA">العربية Arabic (RTL)</option>
          </select>
          <button
            type="button"
            onClick={toggleLiveSpeech}
            className={`flex-1 py-1 px-2 rounded text-[11px] font-semibold flex items-center justify-center gap-1.5 ${
              listening
                ? 'bg-red-500 text-white'
                : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30'
            }`}
          >
            {listening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            <span>{listening ? 'Stop Mic' : 'Auto-Transcribe'}</span>
          </button>
        </div>

        <div className="flex gap-1.5">
          <input
            type="text"
            dir="auto"
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            placeholder="Type English or العربية caption..."
            className="flex-1 bg-[#111318] border border-[#222631] rounded px-2 py-1 text-xs text-zinc-200 outline-none"
          />
          <button
            type="button"
            onClick={() => {
              if (!draftText.trim()) return;
              addCaption(buildCaptionSegment(draftText, playhead, playhead + 3, preset));
              setDraftText('');
            }}
            className="px-2 py-1 rounded bg-amber-500 hover:bg-amber-400 text-black"
            title="Insert Caption at Playhead"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => srtInputRef.current?.click()}
            className="flex-1 py-1 rounded bg-[#171A21] hover:bg-[#222631] border border-[#222631] text-[10px] font-mono text-zinc-300 flex items-center justify-center gap-1"
          >
            <Upload className="w-3 h-3 text-cyan-400" /> Import SRT/VTT
          </button>
          <button
            type="button"
            disabled={captions.length === 0}
            onClick={handleExportSrt}
            className="flex-1 py-1 rounded bg-[#171A21] hover:bg-[#222631] border border-[#222631] disabled:opacity-40 text-[10px] font-mono text-zinc-300 flex items-center justify-center gap-1"
          >
            <Download className="w-3 h-3 text-emerald-400" /> Export SRT
          </button>
          <input
            ref={srtInputRef}
            type="file"
            accept=".srt,.vtt"
            className="hidden"
            onChange={(e) => {
              void handleImportSrt(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        {captions.map((cap) => (
          <div
            key={cap.id}
            className="bg-[#0D0F14] border border-[#222631] rounded p-2 flex items-start justify-between gap-2"
          >
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-mono text-amber-400">
                {cap.startTime.toFixed(1)}s → {cap.endTime.toFixed(1)}s{' '}
                {cap.style.rtl && <span className="text-emerald-400 ml-1">[RTL]</span>}
              </div>
              <p
                dir={cap.style.rtl ? 'rtl' : 'ltr'}
                className="text-xs text-zinc-200 mt-0.5 break-words"
              >
                {cap.text}
              </p>
            </div>
            <button
              type="button"
              onClick={() => deleteCaption(cap.id)}
              className="text-zinc-500 hover:text-red-400 p-0.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
