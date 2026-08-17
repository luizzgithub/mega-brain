const { spawn } = require('child_process');
const { existsSync, readFileSync } = require('fs');
const path = require('path');
const config = require('../config');

const DIARIZE_SCRIPT = path.join(__dirname, '../../scripts/diarize.py');

/**
 * @param {string} audioPath
 * @param {object} [options]
 * @param {string} [options.outputFile]
 * @param {number} [options.minSpeakers]
 * @param {number} [options.maxSpeakers]
 */
function diarizeAudio(audioPath, options = {}) {
  return new Promise((resolve, reject) => {
    const token = config.diarization.hfToken;
    if (!token) {
      reject(new Error('HF_TOKEN não definido no .env. Necessário para diarização pyannote.'));
      return;
    }

    const baseName = path.basename(audioPath, path.extname(audioPath));
    const outputFile = options.outputFile
      ?? path.join(path.dirname(audioPath), `${baseName}-diarization.json`);

    const python = config.diarization.pythonPath;
    const args = [
      DIARIZE_SCRIPT,
      path.resolve(audioPath),
      '-o', path.resolve(outputFile),
    ];

    if (options.minSpeakers != null) {
      args.push('--min-speakers', String(options.minSpeakers));
    }
    if (options.maxSpeakers != null) {
      args.push('--max-speakers', String(options.maxSpeakers));
    }

    const command = `${python} ${args.join(' ')}`;
    const child = spawn(python, args, {
      windowsHide: true,
      env: { ...process.env, HF_TOKEN: token, HUGGING_FACE_HUB_TOKEN: token },
    });

    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (err) => {
      reject(new Error(`Falha ao iniciar diarização (${python}): ${err.message}`));
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Diarização falhou com código ${code}: ${stderr.trim()}`));
        return;
      }
      if (!existsSync(outputFile)) {
        reject(new Error(`Arquivo de diarização não encontrado: ${outputFile}`));
        return;
      }

      const segments = JSON.parse(readFileSync(outputFile, 'utf-8'));
      resolve({ outputFile, segments, command });
    });
  });
}

module.exports = { diarizeAudio };
