const path = require('path');

const VIDEO_EXTENSIONS = new Set([
  '.mp4', '.mkv', '.webm', '.avi', '.mov', '.m4v', '.wmv', '.flv', '.mpeg', '.mpg',
]);

/**
 * @param {string} filename
 * @returns {'video'|'audio'}
 */
function detectSourceType(filename) {
  const ext = path.extname(filename || '').toLowerCase();
  return VIDEO_EXTENSIONS.has(ext) ? 'video' : 'audio';
}

function isVideoFile(filename) {
  return detectSourceType(filename) === 'video';
}

function needsWavExtraction(filename, options = {}) {
  return isVideoFile(filename) || Boolean(options.diarize);
}

module.exports = {
  VIDEO_EXTENSIONS,
  detectSourceType,
  isVideoFile,
  needsWavExtraction,
};
