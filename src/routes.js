const express = require('express');
const multer = require('multer');
const path = require('path');
const config = require('./config');
const queue = require('./queue');
const whisperProcess = require('./whisperProcess');
const { authMiddleware } = require('./middleware/auth');
const { getToolsStatus } = require('./services/checkTools');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: config.maxFileSizeMb * 1024 * 1024 },
});

function parseBool(value) {
  if (value === true || value === 'true' || value === '1') return true;
  return false;
}

function parseOptionalInt(value) {
  if (value == null || value === '') return undefined;
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : undefined;
}

router.post('/transcribe', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No audio or video file provided.' });
    }

    const options = {
      temperature: req.body.temperature,
      response_format: 'json',
      language: req.body.language || config.whisper.language,
      diarize: parseBool(req.body.diarize),
      min_speakers: parseOptionalInt(req.body.min_speakers),
      max_speakers: parseOptionalInt(req.body.max_speakers),
    };

    const startTime = Date.now();
    const result = await queue.addJob(
      req.user.id,
      req.file.path,
      options,
      req.file.originalname
    );
    const durationMs = Date.now() - startTime;

    res.json({
      success: true,
      data: {
        transcription_id: result.transcription_id,
        text: result.text,
        segments: result.segments || [],
        speakers: result.speakers || null,
        source_type: result.source_type,
        diarized: result.diarized,
        duration_ms: durationMs,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.response?.data,
    });
  }
});

router.get('/status', async (req, res) => {
  const queueStats = queue.getStats();
  const tools = await getToolsStatus();

  let whisperStatus;
  if (config.whisper.mode === 'server') {
    const isWhisperRunning = await whisperProcess.isRunning();
    whisperStatus = {
      mode: 'server',
      status: isWhisperRunning ? 'online' : 'offline',
      executable: config.whisper.path,
      model: path.basename(config.whisper.model),
    };
  } else {
    whisperStatus = {
      mode: 'cli',
      status: tools.whisper?.ok ? 'ready' : 'misconfigured',
      executable: config.whisper.cliPath,
      model: config.whisper.modelName,
      models_available: tools.whisper?.models || [],
    };
  }

  res.json({
    whisper: whisperStatus,
    queue: queueStats,
    tools,
    config: {
      whisper_mode: config.whisper.mode,
      model: config.whisper.modelName,
      language: config.whisper.language,
      threads: config.whisper.threads,
      max_file_size_mb: config.maxFileSizeMb,
    },
  });
});

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = router;
