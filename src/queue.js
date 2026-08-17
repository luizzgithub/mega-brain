const { default: PQueue } = require('p-queue');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const config = require('./config');
const logger = require('./logger');
const { db } = require('./db');
const { extractAudio } = require('./services/extractAudio');
const { parseWhisperJson, extractWhisperText } = require('./services/parseWhisperJson');
const { buildSpeakerOutputs } = require('./services/mergeSpeakers');
const { diarizeAudio } = require('./services/diarizeAudio');
const { detectSourceType, needsWavExtraction } = require('./services/mediaUtils');
const whisperCli = require('./services/whisperCli');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function safeUnlink(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return;
  fs.unlink(filePath, (err) => {
    if (err) logger.error(`Failed to delete temp file ${filePath}: ${err}`);
  });
}

function moveMediaFile(sourcePath, userId, transcriptionId, originalFilename) {
  const ext = path.extname(originalFilename || sourcePath) || path.extname(sourcePath);
  const mediaDir = path.join(config.mediaDir, userId);
  ensureDir(mediaDir);

  const storedName = `${transcriptionId}${ext}`;
  const destPath = path.join(mediaDir, storedName);

  if (sourcePath === destPath) {
    return storedName;
  }

  fs.renameSync(sourcePath, destPath);
  return storedName;
}

class TranscriptionQueue {
  constructor() {
    this.queue = new PQueue({ concurrency: config.queueConcurrency });
    this.queue.on('active', () => {
      logger.info(`Queue: Active jobs: ${this.queue.pending}. Remaining jobs: ${this.queue.size}`);
    });
    this.queue.on('idle', () => {
      logger.info('Queue is idle.');
    });
  }

  async addJob(userId, filePath, options = {}, originalFilename = null) {
    return this.queue.add(async () => {
      const start = Date.now();
      const transcriptionId = randomUUID();
      const sourceType = detectSourceType(originalFilename || filePath);
      let wavPath = null;
      let diarizationFile = null;
      let mediaFilename = null;

      let cliTempFiles = [];

      try {
        let whisperInputPath = filePath;

        if (needsWavExtraction(originalFilename || filePath, options)) {
          wavPath = path.join(config.uploadDir, `${transcriptionId}-extracted.wav`);
          logger.info(`Extracting audio via FFmpeg: ${filePath}`);
          await extractAudio(filePath, { outputPath: wavPath });
          whisperInputPath = wavPath;
        }

        const whisperOptions = {
          ...options,
          response_format: 'json',
          outputId: transcriptionId,
        };

        const { data: result, tempFiles } = await this.whisperInference(whisperInputPath, whisperOptions);
        cliTempFiles = tempFiles;
        const durationMs = Date.now() - start;

        let segments = parseWhisperJson(result);
        let text = extractWhisperText(result);
        let speakers = null;
        let diarized = 0;

        if (options.diarize && segments.length > 0) {
          const diarizeWav = wavPath || whisperInputPath;
          try {
            logger.info(`Starting diarization for ${transcriptionId}`);
            const { outputFile, segments: diarSegments } = await diarizeAudio(diarizeWav, {
              minSpeakers: options.min_speakers ?? options.minSpeakers ?? config.diarization.minSpeakers,
              maxSpeakers: options.max_speakers ?? options.maxSpeakers ?? config.diarization.maxSpeakers,
            });
            diarizationFile = outputFile;

            const speakerOutputs = buildSpeakerOutputs({
              transcriptSegments: segments,
              diarization: diarSegments,
            });
            speakers = speakerOutputs.merged;
            text = speakerOutputs.txt || text;
            diarized = 1;
            logger.info(`Diarization complete: ${speakerOutputs.speakers.length} speakers`);
          } catch (diarizeErr) {
            logger.warn(`Diarization failed for ${transcriptionId}, saving segments only: ${diarizeErr.message}`);
          }
        }

        try {
          mediaFilename = moveMediaFile(filePath, userId, transcriptionId, originalFilename);
        } catch (moveErr) {
          logger.warn(`Could not store media file for ${transcriptionId}: ${moveErr.message}`);
        }

        const insert = db.prepare(`
          INSERT INTO transcriptions (
            id, user_id, text, audio_filename, duration_ms,
            source_type, segments_json, speakers_json, media_filename, diarized
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        insert.run(
          transcriptionId,
          userId,
          text || '',
          originalFilename,
          durationMs || 0,
          sourceType,
          segments.length ? JSON.stringify(segments) : null,
          speakers ? JSON.stringify(speakers) : null,
          mediaFilename,
          diarized
        );

        logger.info(`Transcription saved: ${transcriptionId} for user ${userId} (${sourceType}${diarized ? ', diarized' : ''})`);

        try {
          const agent = require('./agent');
          if (agent && typeof agent.processTranscription === 'function') {
            agent.processTranscription(transcriptionId, userId, text || '')
              .catch(err => logger.error(`Agent processing failed for ${transcriptionId}: ${err.message}`));
          }
        } catch (agentErr) {
          logger.warn(`Agent module not available, skipping entity extraction: ${agentErr.message}`);
        }

        try {
          const agent = require('./agent');
          if (agent?.generateSuggestions) {
            agent.generateSuggestions(transcriptionId, userId, text || '')
              .catch(err => logger.error('Suggestions failed for ' + transcriptionId + ': ' + err.message));
          }
        } catch (e) {
          logger.warn('Suggestions module error: ' + e.message);
        }

        return {
          transcription_id: transcriptionId,
          text: text || '',
          segments,
          speakers,
          source_type: sourceType,
          diarized: Boolean(diarized),
          duration_ms: durationMs,
          result,
        };
      } finally {
        cliTempFiles.forEach(safeUnlink);
        if (wavPath) safeUnlink(wavPath);
        if (diarizationFile) safeUnlink(diarizationFile);
        if (filePath.startsWith(config.uploadDir) && fs.existsSync(filePath)) {
          safeUnlink(filePath);
        }
      }
    });
  }

  async whisperInference(filePath, options = {}) {
    if (config.whisper.mode === 'cli') {
      return whisperCli.transcribe(filePath, options);
    }

    const data = await this.whisperInferenceServer(filePath, options);
    return { data, tempFiles: [] };
  }

  async whisperInferenceServer(filePath, options = {}) {
    const url = `http://${config.whisper.host}:${config.whisper.port}/inference`;
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));
    form.append('temperature', options.temperature || '0.0');
    form.append('response_format', options.response_format || 'json');
    if (options.language) {
      form.append('language', options.language);
    }

    logger.info(`Sending job to Whisper server: ${filePath}`);
    const start = Date.now();

    const response = await axios.post(url, form, {
      headers: form.getHeaders(),
      timeout: 0,
    });

    const duration = Date.now() - start;
    logger.info(`Transcription completed in ${duration}ms`);

    let data = response.data;
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch {
        data = { text: data };
      }
    }

    return data;
  }

  getStats() {
    return {
      pending: this.queue.pending,
      size: this.queue.size,
      concurrency: config.queueConcurrency,
    };
  }
}

module.exports = new TranscriptionQueue();
