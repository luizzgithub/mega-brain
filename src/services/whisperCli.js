const { spawn } = require('child_process');
const { existsSync, readFileSync } = require('fs');
const path = require('path');
const config = require('../config');
const logger = require('../logger');
const { resolveCppModelPath } = require('./whisperConfig');

function runWhisperCli(whisperPath, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(whisperPath, args, {
      windowsHide: true,
      cwd: path.dirname(whisperPath),
    });
    let stderr = '';

    child.stdout.on('data', () => {});

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (err) => {
      reject(new Error(`Falha ao iniciar whisper-cli (${whisperPath}): ${err.message}`));
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`whisper-cli falhou com código ${code}: ${stderr.trim()}`));
        return;
      }
      resolve(stderr);
    });
  });
}

function collectTempFiles(outputBase) {
  const extensions = ['.json', '.txt', '.srt', '.vtt'];
  return extensions
    .map((ext) => `${outputBase}${ext}`)
    .filter((filePath) => existsSync(filePath));
}

/**
 * Transcreve áudio via whisper-cli.exe (processo sob demanda).
 *
 * @param {string} audioPath
 * @param {object} [options]
 * @param {string} [options.outputId] - prefixo dos arquivos temporários
 * @param {string} [options.language]
 * @returns {Promise<{ data: object, tempFiles: string[] }>}
 */
async function transcribe(audioPath, options = {}) {
  if (!audioPath || typeof audioPath !== 'string') {
    throw new Error('O caminho do áudio é obrigatório.');
  }
  if (!existsSync(audioPath)) {
    throw new Error(`Arquivo de áudio não encontrado: ${audioPath}`);
  }

  const whisperPath = config.whisper.cliPath;
  const modelPath = resolveCppModelPath(config.whisper.modelName);
  const outputId = options.outputId
    || path.basename(audioPath, path.extname(audioPath));
  const outputBase = path.join(config.uploadDir, `${outputId}-whisper`);
  const absoluteAudio = path.resolve(audioPath);
  const language = options.language || config.whisper.language;

  const args = [
    '-m', modelPath,
    '-f', absoluteAudio,
    '-of', outputBase,
    '-oj',
    '-otxt',
    '-np',
    '-l', language,
    '-t', String(config.whisper.threads),
  ];

  const command = `${whisperPath} ${args.join(' ')}`;
  logger.info(`Running whisper-cli: ${command}`);

  const start = Date.now();
  await runWhisperCli(whisperPath, args);
  logger.info(`whisper-cli completed in ${Date.now() - start}ms`);

  const jsonFile = `${outputBase}.json`;
  const txtFile = `${outputBase}.txt`;

  if (!existsSync(jsonFile)) {
    throw new Error(`Arquivo JSON não encontrado após whisper-cli: ${jsonFile}`);
  }

  const data = JSON.parse(readFileSync(jsonFile, 'utf-8'));
  if (!data.text && existsSync(txtFile)) {
    data.text = readFileSync(txtFile, 'utf-8').trim();
  }

  return {
    data,
    tempFiles: collectTempFiles(outputBase),
  };
}

module.exports = { transcribe };
