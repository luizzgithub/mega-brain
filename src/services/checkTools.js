const { spawn } = require('child_process');
const { existsSync } = require('fs');
const path = require('path');
const config = require('../config');
const { listCppModels, validateCppModelDir, validateConfiguredModel } = require('./whisperConfig');

const TIMEOUT_MS = 15000;

function isExplicitPath(command) {
  return path.isAbsolute(command) || command.includes('\\') || command.includes('/');
}

function commandExists(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { windowsHide: true });

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      resolve(false);
    }, TIMEOUT_MS);

    child.on('error', () => {
      clearTimeout(timer);
      resolve(false);
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      resolve(code === 0);
    });

    child.stdout?.on('data', () => {});
    child.stderr?.on('data', () => {});
  });
}

async function checkFFmpeg() {
  const ffmpegPath = config.ffmpeg.path;

  if (isExplicitPath(ffmpegPath) && !existsSync(ffmpegPath)) {
    return {
      name: 'FFmpeg',
      path: ffmpegPath,
      ok: false,
      hint: `Arquivo não encontrado: ${ffmpegPath}. Corrija FFMPEG_PATH no .env.`,
    };
  }

  const ok = await commandExists(ffmpegPath, ['-version']);

  return {
    name: 'FFmpeg',
    path: ffmpegPath,
    ok,
    hint: ok
      ? ''
      : 'FFmpeg não encontrado. Instale em https://ffmpeg.org/download.html, adicione ao PATH ou defina FFMPEG_PATH no .env.',
  };
}

async function checkPython() {
  const pythonPath = config.diarization.pythonPath;

  if (isExplicitPath(pythonPath) && !existsSync(pythonPath)) {
    return {
      name: 'Python',
      path: pythonPath,
      ok: false,
      hint: `Arquivo não encontrado: ${pythonPath}. Corrija PYTHON_PATH no .env.`,
    };
  }

  const ok = await commandExists(pythonPath, ['--version']);

  return {
    name: 'Python',
    path: pythonPath,
    ok,
    hint: ok
      ? ''
      : 'Python não encontrado. Instale Python 3 e defina PYTHON_PATH no .env.',
  };
}

function checkDiarizationToken() {
  const token = config.diarization.hfToken;
  const ok = Boolean(token && token.trim());

  return {
    name: 'HF_TOKEN',
    path: ok ? '(definido)' : '(ausente)',
    ok,
    hint: ok
      ? ''
      : 'Defina HF_TOKEN no .env com token HuggingFace para pyannote/speaker-diarization-3.1.',
  };
}

async function checkWhisperCli() {
  const cliPath = config.whisper.cliPath;

  if (isExplicitPath(cliPath) && !existsSync(cliPath)) {
    return {
      name: 'Whisper CLI',
      path: cliPath,
      ok: false,
      hint: `Arquivo não encontrado: ${cliPath}. Defina WHISPER_CLI_PATH no .env.`,
      mode: 'cli',
      models: [],
    };
  }

  const executableOk = await commandExists(cliPath, ['-h']);
  if (!executableOk) {
    return {
      name: 'Whisper CLI',
      path: cliPath,
      ok: false,
      hint: 'whisper-cli.exe não encontrado ou não executa. Baixe whisper.cpp e defina WHISPER_CLI_PATH.',
      mode: 'cli',
      models: [],
    };
  }

  const modelsDirCheck = validateCppModelDir();
  if (!modelsDirCheck.ok) {
    return {
      name: 'Whisper CLI',
      path: cliPath,
      ok: false,
      hint: modelsDirCheck.hint,
      mode: 'cli',
      models: [],
    };
  }

  const modelCheck = validateConfiguredModel();
  if (!modelCheck.ok) {
    return {
      name: 'Whisper CLI',
      path: cliPath,
      ok: false,
      hint: modelCheck.hint,
      mode: 'cli',
      models: listCppModels(),
    };
  }

  return {
    name: 'Whisper CLI',
    path: cliPath,
    ok: true,
    hint: '',
    mode: 'cli',
    model: config.whisper.modelName,
    models: listCppModels(),
  };
}

async function checkWhisperServer() {
  const serverPath = config.whisper.path;
  const modelPath = config.whisper.model;

  if (isExplicitPath(serverPath) && !existsSync(serverPath)) {
    return {
      name: 'Whisper Server',
      path: serverPath,
      ok: false,
      hint: `Arquivo não encontrado: ${serverPath}. Defina WHISPER_SERVER_PATH no .env.`,
      mode: 'server',
    };
  }

  const executableOk = await commandExists(serverPath, ['--help']);
  const modelOk = existsSync(modelPath);

  if (!executableOk) {
    return {
      name: 'Whisper Server',
      path: serverPath,
      ok: false,
      hint: 'whisper-server.exe não encontrado. Defina WHISPER_SERVER_PATH no .env.',
      mode: 'server',
    };
  }

  if (!modelOk) {
    return {
      name: 'Whisper Server',
      path: serverPath,
      ok: false,
      hint: `Modelo não encontrado: ${modelPath}. Execute npm run download-model.`,
      mode: 'server',
    };
  }

  return {
    name: 'Whisper Server',
    path: serverPath,
    ok: true,
    hint: '',
    mode: 'server',
    model: path.basename(modelPath),
  };
}

async function checkWhisper() {
  if (config.whisper.mode === 'server') {
    return checkWhisperServer();
  }
  return checkWhisperCli();
}

async function checkAllTools(options = {}) {
  const { silent = false } = options;
  const results = await Promise.all([
    checkFFmpeg(),
    checkWhisper(),
    checkPython(),
    Promise.resolve(checkDiarizationToken()),
  ]);

  if (!silent) {
    for (const result of results) {
      const status = result.ok ? 'OK' : 'AUSENTE';
      console.log(`${result.name} (${result.path}): ${status}`);
      if (!result.ok && result.hint) {
        console.log(`  ${result.hint}`);
      }
    }
  }

  return results;
}

async function getToolsStatus() {
  const [ffmpeg, whisper, python, hfToken] = await Promise.all([
    checkFFmpeg(),
    checkWhisper(),
    checkPython(),
    Promise.resolve(checkDiarizationToken()),
  ]);

  return {
    ffmpeg: { ok: ffmpeg.ok, path: ffmpeg.path, hint: ffmpeg.hint || undefined },
    whisper: {
      ok: whisper.ok,
      mode: whisper.mode,
      path: whisper.path,
      model: whisper.model,
      models: whisper.models,
      hint: whisper.hint || undefined,
    },
    diarization: {
      ok: python.ok && hfToken.ok,
      python: { ok: python.ok, path: python.path },
      hf_token: { ok: hfToken.ok },
      hint: !python.ok
        ? python.hint
        : !hfToken.ok
          ? hfToken.hint
          : undefined,
    },
  };
}

module.exports = {
  checkFFmpeg,
  checkPython,
  checkDiarizationToken,
  checkWhisper,
  checkWhisperCli,
  checkWhisperServer,
  checkAllTools,
  getToolsStatus,
};
