const { existsSync, readdirSync } = require('fs');
const path = require('path');
const config = require('../config');

function getModelsDir() {
  return config.whisper.modelsDir;
}

function listCppModels() {
  const modelsDir = getModelsDir();
  if (!existsSync(modelsDir)) {
    return [];
  }

  return readdirSync(modelsDir)
    .filter((file) => file.startsWith('ggml-') && file.endsWith('.bin'))
    .map((file) => file.slice('ggml-'.length, -'.bin'.length))
    .sort();
}

function resolveCppModelPath(model = config.whisper.modelName) {
  const modelsDir = getModelsDir();
  const candidates = [
    path.join(modelsDir, `ggml-${model}.bin`),
    path.join(modelsDir, `${model}.bin`),
    path.isAbsolute(model) ? model : path.join(modelsDir, model),
  ];

  const modelPath = candidates.find((candidate) => existsSync(candidate));
  if (modelPath) {
    return modelPath;
  }

  const available = listCppModels();
  const hint = available.length > 0
    ? `Modelos encontrados em ${modelsDir}: ${available.join(', ')}`
    : `Nenhum modelo ggml-*.bin em ${modelsDir}`;

  throw new Error(`Modelo Whisper.cpp não encontrado para "${model}". ${hint}`);
}

function validateCppModelDir() {
  const modelsDir = getModelsDir();

  if (!existsSync(modelsDir)) {
    return {
      ok: false,
      hint: `Pasta de modelos não encontrada: ${modelsDir}. Defina WHISPER_MODELS_DIR no .env.`,
    };
  }

  const available = listCppModels();
  if (available.length === 0) {
    return {
      ok: false,
      hint: `Nenhum modelo ggml-*.bin em ${modelsDir}. Execute npm run download-model.`,
    };
  }

  return { ok: true, hint: '', models: available };
}

function validateConfiguredModel() {
  try {
    resolveCppModelPath(config.whisper.modelName);
    return { ok: true, hint: '' };
  } catch (err) {
    return { ok: false, hint: err.message };
  }
}

module.exports = {
  getModelsDir,
  listCppModels,
  resolveCppModelPath,
  validateCppModelDir,
  validateConfiguredModel,
};
