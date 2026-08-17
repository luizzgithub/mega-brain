/**
 * Normaliza resposta JSON do whisper-server / whisper.cpp.
 *
 * @param {object} data
 * @returns {Array<{ start: number, end: number, text: string }>}
 */
function parseWhisperJson(data) {
  if (!data || typeof data !== 'object') {
    return [];
  }

  const segments = [];

  if (Array.isArray(data.transcription)) {
    for (const seg of data.transcription) {
      const startMs = seg.offsets?.from ?? 0;
      const endMs = seg.offsets?.to ?? startMs;
      const text = (seg.text ?? '').trim();
      if (!text) continue;

      segments.push({
        start: startMs / 1000,
        end: endMs / 1000,
        text,
      });
    }
    return segments;
  }

  if (Array.isArray(data.segments)) {
    for (const seg of data.segments) {
      const text = (seg.text ?? '').trim();
      if (!text) continue;
      segments.push({
        start: seg.start ?? 0,
        end: seg.end ?? seg.start ?? 0,
        text,
      });
    }
  }

  return segments;
}

/**
 * Extrai texto plano da resposta do whisper-server.
 *
 * @param {object|string} data
 * @returns {string}
 */
function extractWhisperText(data) {
  if (typeof data === 'string') {
    return data.trim();
  }
  if (!data || typeof data !== 'object') {
    return '';
  }
  if (typeof data.text === 'string' && data.text.trim()) {
    return data.text.trim();
  }

  const segments = parseWhisperJson(data);
  if (segments.length) {
    return segments.map((s) => s.text).join(' ').trim();
  }

  return '';
}

module.exports = { parseWhisperJson, extractWhisperText };
