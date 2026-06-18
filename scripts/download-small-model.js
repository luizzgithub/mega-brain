const axios = require('axios');
const fs = require('fs');
const path = require('path');
const config = require('../src/config');
const logger = require('../src/logger');

// Mudamos para o modelo 'small'
const MODEL_URL = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin';
// Pega o diretório base configurado
const MODEL_DIR = path.dirname(config.whisper.model);
const MODEL_PATH = path.join(MODEL_DIR, 'ggml-small.bin');

async function downloadModel() {
  if (!fs.existsSync(MODEL_DIR)) {
    fs.mkdirSync(MODEL_DIR, { recursive: true });
  }

  if (fs.existsSync(MODEL_PATH)) {
    logger.info(`Model already exists at ${MODEL_PATH}. Skipping download.`);
    return;
  }

  logger.info(`Downloading GGML small model (~480MB) to ${MODEL_PATH}...`);
  logger.info(`URI: ${MODEL_URL}`);
  
  try {
    const response = await axios({
      method: 'get',
      url: MODEL_URL,
      responseType: 'stream',
      onDownloadProgress: (progressEvent) => {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        if (percentCompleted % 10 === 0) {
            logger.info(`Download progress: ${percentCompleted}%`);
        }
      }
    });

    const writer = fs.createWriteStream(MODEL_PATH);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        logger.info('Download complete.');
        resolve();
      });
      writer.on('error', (err) => {
        logger.error('Download failed.');
        reject(err);
      });
    });
  } catch (error) {
    logger.error(`Failed to download model: ${error.message}`);
    process.exit(1);
  }
}

downloadModel();
