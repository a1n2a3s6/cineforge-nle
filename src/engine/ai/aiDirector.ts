import { CinemaLutId, TransitionType } from '../../types/effects';
import { AspectRatioPreset } from '../../types/timeline';

export type DirectorAction =
  | { type: 'OPEN_SILENCE_MODAL' }
  | { type: 'OPEN_BEAT_MODAL' }
  | { type: 'OPEN_EXPORT_MODAL' }
  | { type: 'APPLY_LUT'; lutId: CinemaLutId }
  | { type: 'SET_SCALE'; scale: number }
  | { type: 'SET_ASPECT_RATIO'; ratio: AspectRatioPreset }
  | { type: 'ADD_TRANSITION'; transition: TransitionType }
  | { type: 'SET_VHS_GLITCH'; amount: number }
  | { type: 'SET_FILM_GRAIN'; amount: number }
  | { type: 'ENABLE_CHROMA_KEY'; color: string }
  | { type: 'SPLIT_AT_PLAYHEAD' }
  | { type: 'RESET_COLOR' };

export interface DirectorPlan {
  summary: string;
  actions: DirectorAction[];
  source: 'offline-parser' | 'gemini' | 'groq';
}

export function parseOfflineDirectorCommand(prompt: string): DirectorPlan {
  const q = prompt.toLowerCase();
  const actions: DirectorAction[] = [];
  const notes: string[] = [];

  if (q.includes('silence') || q.includes('dead air') || q.includes('pause')) {
    actions.push({ type: 'OPEN_SILENCE_MODAL' });
    notes.push('Opened Auto-Silence Cutter');
  }
  if (q.includes('beat') || q.includes('bpm') || q.includes('sync')) {
    actions.push({ type: 'OPEN_BEAT_MODAL' });
    notes.push('Opened Beat-Sync Detector');
  }
  if (q.includes('export') || q.includes('render') || q.includes('download')) {
    actions.push({ type: 'OPEN_EXPORT_MODAL' });
    notes.push('Opened 60fps Local Export Pipeline');
  }

  if (q.includes('teal') || q.includes('orange')) {
    actions.push({ type: 'APPLY_LUT', lutId: 'teal-orange' });
    notes.push('Applied Teal & Orange Cinema LUT');
  } else if (q.includes('kodak') || q.includes('2383') || q.includes('film look')) {
    actions.push({ type: 'APPLY_LUT', lutId: 'kodak-2383' });
    notes.push('Applied Kodak 2383 Print LUT');
  } else if (q.includes('noir') || q.includes('black and white') || q.includes('b&w')) {
    actions.push({ type: 'APPLY_LUT', lutId: 'noir-bw' });
    notes.push('Applied Noir B&W LUT');
  } else if (q.includes('cyber') || q.includes('neon')) {
    actions.push({ type: 'APPLY_LUT', lutId: 'cyber-neon' });
    notes.push('Applied Cyber Neon LUT');
  } else if (q.includes('vintage') || q.includes('warm') || q.includes('retro')) {
    actions.push({ type: 'APPLY_LUT', lutId: 'warm-vintage' });
    notes.push('Applied Warm Vintage LUT');
  } else if (q.includes('reset color') || q.includes('rec709')) {
    actions.push({ type: 'RESET_COLOR' });
    notes.push('Reset Color Grade to Clean Rec.709');
  }

  const zoomMatch = q.match(/(?:zoom|scale)\s*(?:to\s*)?(\d+(?:\.\d+)?)x?/);
  if (zoomMatch) {
    const val = Math.max(0.2, Math.min(3, parseFloat(zoomMatch[1])));
    actions.push({ type: 'SET_SCALE', scale: val });
    notes.push(`Set clip scale to ${val.toFixed(2)}x`);
  }

  if (q.includes('9:16') || q.includes('reels') || q.includes('tiktok') || q.includes('shorts')) {
    actions.push({ type: 'SET_ASPECT_RATIO', ratio: '9:16' });
    notes.push('Switched sequence to 9:16 Reels');
  } else if (q.includes('21:9') || q.includes('cinema')) {
    actions.push({ type: 'SET_ASPECT_RATIO', ratio: '21:9' });
    notes.push('Switched sequence to 21:9 Cinema');
  } else if (q.includes('1:1') || q.includes('square')) {
    actions.push({ type: 'SET_ASPECT_RATIO', ratio: '1:1' });
    notes.push('Switched sequence to 1:1 Square');
  } else if (q.includes('16:9') || q.includes('youtube') || q.includes('landscape')) {
    actions.push({ type: 'SET_ASPECT_RATIO', ratio: '16:9' });
    notes.push('Switched sequence to 16:9 Broadcast HD');
  }

  if (q.includes('cross dissolve') || q.includes('dissolve') || q.includes('fade')) {
    actions.push({ type: 'ADD_TRANSITION', transition: 'cross-dissolve' });
    notes.push('Added Cross Dissolve transition');
  } else if (q.includes('dip to black')) {
    actions.push({ type: 'ADD_TRANSITION', transition: 'dip-to-black' });
    notes.push('Added Dip to Black transition');
  } else if (q.includes('whip pan')) {
    actions.push({ type: 'ADD_TRANSITION', transition: 'whip-pan' });
    notes.push('Added Whip Pan transition');
  } else if (q.includes('zoom blur')) {
    actions.push({ type: 'ADD_TRANSITION', transition: 'zoom-blur' });
    notes.push('Added Zoom Blur transition');
  } else if (q.includes('glitch cut')) {
    actions.push({ type: 'ADD_TRANSITION', transition: 'glitch-cut' });
    notes.push('Added Glitch Cut transition');
  }

  if (q.includes('vhs') || (q.includes('glitch') && !q.includes('cut'))) {
    actions.push({ type: 'SET_VHS_GLITCH', amount: 0.45 });
    notes.push('Enabled VHS Glitch shader FX');
  }
  if (q.includes('grain')) {
    actions.push({ type: 'SET_FILM_GRAIN', amount: 0.4 });
    notes.push('Added 35mm Film Grain');
  }
  if (q.includes('green screen') || q.includes('chroma')) {
    actions.push({ type: 'ENABLE_CHROMA_KEY', color: '#00FF00' });
    notes.push('Enabled GPU Green Screen Chroma Key');
  }
  if (q.includes('split') || q.includes('razor')) {
    actions.push({ type: 'SPLIT_AT_PLAYHEAD' });
    notes.push('Split selected clip at playhead');
  }

  return {
    summary:
      notes.length > 0
        ? notes.join(' · ')
        : 'Try: "apply teal orange lut", "zoom 1.3x", "add cross dissolve", "switch to 9:16 reels", or "cut silences".',
    actions,
    source: 'offline-parser',
  };
}

export async function runAIDirector(
  prompt: string,
  provider: 'offline' | 'gemini' | 'groq',
  apiKey: string
): Promise<DirectorPlan> {
  if (provider === 'offline' || !apiKey.trim()) {
    return parseOfflineDirectorCommand(prompt);
  }

  const systemPrompt =
    'You are CineForge Pro AI Edit Director. Convert the user editing request into a JSON object: {"summary":"...","actions":[...]}. Allowed actions: {"type":"APPLY_LUT","lutId":"teal-orange|kodak-2383|noir-bw|cyber-neon|warm-vintage|rec709"}, {"type":"SET_SCALE","scale":1.3}, {"type":"SET_ASPECT_RATIO","ratio":"16:9|9:16|1:1|21:9"}, {"type":"ADD_TRANSITION","transition":"cross-dissolve|dip-to-black|whip-pan|zoom-blur|glitch-cut"}, {"type":"SET_VHS_GLITCH","amount":0.4}, {"type":"SET_FILM_GRAIN","amount":0.35}, {"type":"OPEN_SILENCE_MODAL"}, {"type":"OPEN_BEAT_MODAL"}, {"type":"OPEN_EXPORT_MODAL"}, {"type":"SPLIT_AT_PLAYHEAD"}. Return ONLY valid JSON.';

  try {
    if (provider === 'gemini') {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey.trim())}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${systemPrompt}\n\nUser request: ${prompt}` }] }],
            generationConfig: { responseMimeType: 'application/json' },
          }),
        }
      );
      if (!res.ok) throw new Error('Gemini API request failed');
      const data = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      const parsed = JSON.parse(raw) as { summary?: string; actions?: DirectorAction[] };
      return {
        summary: parsed.summary || 'Executed Gemini Director Plan',
        actions: Array.isArray(parsed.actions) ? parsed.actions : [],
        source: 'gemini',
      };
    }

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
      }),
    });
    if (!res.ok) throw new Error('Groq API request failed');
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = data.choices?.[0]?.message?.content ?? '';
    const parsed = JSON.parse(raw) as { summary?: string; actions?: DirectorAction[] };
    return {
      summary: parsed.summary || 'Executed Groq Director Plan',
      actions: Array.isArray(parsed.actions) ? parsed.actions : [],
      source: 'groq',
    };
  } catch {
    return parseOfflineDirectorCommand(prompt);
  }
}
