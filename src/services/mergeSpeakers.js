/**
 * @param {number} seconds
 * @returns {string}
 */
function formatTimestamp(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * @param {number} seconds
 * @returns {string}
 */
function formatSrtTime(seconds) {
  const totalMs = Math.max(0, Math.round(seconds * 1000));
  const h = Math.floor(totalMs / 3600000);
  const m = Math.floor((totalMs % 3600000) / 60000);
  const s = Math.floor((totalMs % 60000) / 1000);
  const ms = totalMs % 1000;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

/**
 * @param {Array<{ start: number, end: number, speaker: string }>} diarization
 * @param {number} time
 * @returns {string}
 */
function findSpeakerAt(diarization, time) {
  for (const seg of diarization) {
    if (seg.start <= time && time <= seg.end) {
      return seg.speaker;
    }
  }

  let best = null;
  let bestOverlap = 0;
  for (const seg of diarization) {
    const overlapStart = Math.max(seg.start, time - 0.5);
    const overlapEnd = Math.min(seg.end, time + 0.5);
    const overlap = Math.max(0, overlapEnd - overlapStart);
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      best = seg.speaker;
    }
  }

  return best ?? 'SPEAKER_UNKNOWN';
}

/**
 * @param {Array<{ start: number, end: number, text: string }>} transcriptSegments
 * @param {Array<{ start: number, end: number, speaker: string }>} diarization
 */
function mergeTranscriptWithSpeakers(transcriptSegments, diarization) {
  return transcriptSegments.map((seg) => {
    const midpoint = (seg.start + seg.end) / 2;
    const speaker = findSpeakerAt(diarization, midpoint);
    return {
      start: seg.start,
      end: seg.end,
      text: seg.text,
      speaker,
      timestamp: formatTimestamp(seg.start),
    };
  });
}

function toSpeakersTxt(merged) {
  return merged
    .map((seg) => `[${seg.timestamp}] ${seg.speaker}: ${seg.text}`)
    .join('\n');
}

function toSpeakersSrt(merged) {
  return merged
    .map((seg, i) => [
      String(i + 1),
      `${formatSrtTime(seg.start)} --> ${formatSrtTime(seg.end)}`,
      `[${seg.speaker}] ${seg.text}`,
      '',
    ].join('\n'))
    .join('\n');
}

function toSegmentsTxt(segments) {
  return segments
    .map((seg) => `[${formatTimestamp(seg.start)}] ${seg.text}`)
    .join('\n');
}

function toSegmentsSrt(segments) {
  return segments
    .map((seg, i) => [
      String(i + 1),
      `${formatSrtTime(seg.start)} --> ${formatSrtTime(seg.end)}`,
      seg.text,
      '',
    ].join('\n'))
    .join('\n');
}

/**
 * @param {object} options
 * @param {Array} options.transcriptSegments
 * @param {Array} options.diarization
 */
function buildSpeakerOutputs({ transcriptSegments, diarization }) {
  const merged = mergeTranscriptWithSpeakers(transcriptSegments, diarization);
  const speakers = [...new Set(merged.map((s) => s.speaker))].sort();

  return {
    merged,
    speakers,
    txt: toSpeakersTxt(merged),
    srt: toSpeakersSrt(merged),
    json: merged,
  };
}

/**
 * @param {Array<{ start: number, end: number, text: string }>} segments
 * @param {'txt'|'json'|'srt'} format
 * @param {Array|null} speakers
 */
function exportTranscription(segments, format, speakers = null) {
  const data = speakers?.length ? speakers : segments;

  switch (format) {
    case 'json':
      return JSON.stringify(data, null, 2);
    case 'srt':
      return speakers?.length ? toSpeakersSrt(speakers) : toSegmentsSrt(segments);
    case 'txt':
    default:
      return speakers?.length ? toSpeakersTxt(speakers) : toSegmentsTxt(segments);
  }
}

module.exports = {
  formatTimestamp,
  formatSrtTime,
  findSpeakerAt,
  mergeTranscriptWithSpeakers,
  buildSpeakerOutputs,
  exportTranscription,
};
