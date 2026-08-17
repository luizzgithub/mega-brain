const { spawn } = require('child_process');
const { existsSync, mkdirSync } = require('fs');
const path = require('path');
const config = require('../config');

/**
 * Extrai o áudio de um vídeo usando FFmpeg.
 * Converte para WAV (PCM 16kHz mono), formato recomendado pelo Whisper.
 *
 * @param {string} videoPath
 * @param {object} [options]
 * @param {string} [options.outputDir]
 * @param {string} [options.outputPath]
 * @param {number} [options.sampleRate=16000]
 * @returns {Promise<{ outputPath: string, command: string }>}
 */
function extractAudio(videoPath, options = {}) {
  return new Promise((resolve, reject) => {
    const { outputDir = config.uploadDir, sampleRate = 16000 } = options;

    if (!videoPath || typeof videoPath !== 'string') {
      reject(new Error('O caminho do vídeo é obrigatório.'));
      return;
    }
    if (!existsSync(videoPath)) {
      reject(new Error(`Arquivo de vídeo não encontrado: ${videoPath}`));
      return;
    }

    mkdirSync(outputDir, { recursive: true });

    const ext = path.extname(videoPath);
    const base = path.basename(videoPath, ext);
    const outputPath = options.outputPath || path.join(outputDir, `${base}-extracted.wav`);

    const ffmpeg = config.ffmpeg.path;
    const args = [
      '-y',
      '-hide_banner',
      '-loglevel', 'error',
      '-i', videoPath,
      '-vn',
      '-ac', '1',
      '-ar', String(sampleRate),
      '-f', 'wav',
      outputPath,
    ];

    const child = spawn(ffmpeg, args, { windowsHide: true });
    let stderr = '';

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (err) => {
      reject(new Error(`Falha ao iniciar o FFmpeg (${ffmpeg}): ${err.message}`));
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ outputPath, command: `${ffmpeg} ${args.join(' ')}` });
      } else {
        reject(new Error(`FFmpeg falhou com código ${code}: ${stderr.trim()}`));
      }
    });
  });
}

module.exports = { extractAudio };
