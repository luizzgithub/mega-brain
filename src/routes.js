const express = require('express');
const multer = require('multer');
const path = require('path');
const config = require('./config');
const queue = require('./queue');
const whisperProcess = require('./whisperProcess');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: config.maxFileSizeMb * 1024 * 1024 }
});

router.post('/transcribe', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No audio file provided.' });
    }

    const options = {
      temperature: req.body.temperature,
      response_format: req.body.response_format || 'json',
      language: req.body.language || config.whisper.language
    };

    // Add to queue and wait for result
    const startTime = Date.now();
    const result = await queue.addJob(req.file.path, options);
    const durationMs = Date.now() - startTime;

    res.json({
      success: true,
      result,
      duration_ms: durationMs
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.response?.data
    });
  }
});

router.get('/status', async (req, res) => {
  const isWhisperRunning = await whisperProcess.isRunning();
  const queueStats = queue.getStats();

  res.json({
    whisper_server: isWhisperRunning ? 'online' : 'offline',
    queue: queueStats,
    config: {
      model: path.basename(config.whisper.model),
      language: config.whisper.language,
      threads: config.whisper.threads
    }
  });
});

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = router;
