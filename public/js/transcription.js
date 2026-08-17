import { STATE } from './state.js';
import { apiCall, fetchMediaObjectUrl, downloadTranscriptionExport } from './api.js';
import { toast, escapeHtml, getCss } from './utils.js';
import { getContentContainer } from './shell.js';

let waveCtx;
let waveAnim;
let entryCounter = 0;
let detailMediaUrl = null;
let activeDetailId = null;
let activeDetailData = null;

function historyEl() {
  return document.getElementById('transcriptionHistory');
}

function formatTime(isoOrDate) {
  const d = isoOrDate ? new Date(isoOrDate) : new Date();
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatSegmentTime(seconds) {
  const total = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function extractText(data) {
  return (data && (
    data.text ||
    data.text_preview ||
    (typeof data.result === 'string' ? data.result : data.result?.text) ||
    data.transcription
  )) || '(sem texto)';
}

function renderEntities(entities) {
  if (!entities?.length) return '';
  return '<div class="entity-list">' + entities.map(e =>
    `<span class="entity-chip">${escapeHtml(String(e.value || e.name || e))}${e.type ? ' · ' + escapeHtml(String(e.type)) : ''}</span>`
  ).join('') + '</div>';
}

function sourceBadge(entry) {
  if (entry.source_type === 'video') {
    return '<span class="badge info">Vídeo</span>';
  }
  if (entry.diarized) {
    return '<span class="badge info">Falantes</span>';
  }
  return '';
}

function scrollHistoryToBottom() {
  const el = historyEl();
  if (el) el.scrollTop = el.scrollHeight;
}

function updateEmptyState() {
  const empty = document.getElementById('transcriptionEmpty');
  if (!empty) return;
  const hasEntries = historyEl()?.querySelector('.transcription-entry');
  empty.style.display = hasEntries ? 'none' : 'block';
}

function buildEntryHtml(entry) {
  const { id, text, createdAt, status, entities, error, source_type, diarized } = entry;
  const isPending = status === 'pending';
  const isError = status === 'error';
  const badge = isPending
    ? '<span class="badge analyzing">Analisando</span>'
    : isError
      ? '<span class="badge analyzing">Erro</span>'
      : '<span class="badge done">Transcrito</span>';

  const copyBtn = (!isPending && !isError && text && text !== '(sem texto)')
    ? `<button type="button" class="btn btn-ghost btn-sm" data-action="copy-transcription">Copiar</button>`
    : '';

  const detailBtn = (!isPending && !isError && id && !String(id).startsWith('pending-'))
    ? `<button type="button" class="btn btn-ghost btn-sm" data-action="open-detail">Detalhes</button>`
    : '';

  const preview = escapeHtml(text.length > 280 ? text.slice(0, 280) + '…' : text);

  const body = isPending
    ? `<div class="transcription-entry-text">${escapeHtml(text || 'Enviando arquivo...')}</div>`
    : isError
      ? `<div class="transcription-entry-text">${escapeHtml(error || 'Falha na transcrição')}</div>`
      : `<div class="transcription-entry-text">${preview}</div>${renderEntities(entities)}`;

  return `<article class="transcription-entry${isPending ? ' pending' : ''}${isError ? ' error' : ''}" data-entry-id="${escapeHtml(id)}" data-source-type="${escapeHtml(source_type || 'audio')}" data-diarized="${diarized ? '1' : '0'}">
    <div class="transcription-entry-header">
      <div class="transcription-entry-meta">
        ${badge}
        ${sourceBadge(entry)}
        <span class="transcription-time">${escapeHtml(formatTime(createdAt))}</span>
      </div>
      <div class="transcription-entry-actions">${detailBtn}${copyBtn}</div>
    </div>
    ${body}
  </article>`;
}

function appendEntryToDom(entry, replaceId = null) {
  const container = historyEl();
  if (!container) return;

  const html = buildEntryHtml(entry);
  if (replaceId) {
    const existing = container.querySelector(`[data-entry-id="${replaceId}"]`);
    if (existing) {
      existing.outerHTML = html;
      updateEmptyState();
      scrollHistoryToBottom();
      return;
    }
  }

  container.insertAdjacentHTML('beforeend', html);
  updateEmptyState();
  scrollHistoryToBottom();
}

function addPendingEntry(isVideo = false) {
  const id = `pending-${++entryCounter}`;
  STATE.pendingTranscriptionId = id;
  const entry = {
    id,
    text: isVideo ? 'Extraindo áudio e transcrevendo vídeo...' : 'Transcrevendo áudio...',
    createdAt: new Date().toISOString(),
    status: 'pending',
  };
  appendEntryToDom(entry);
  return id;
}

function pushHistoryEntry(data) {
  const text = extractText(data);
  const entry = {
    id: data.transcription_id || `local-${++entryCounter}`,
    text,
    createdAt: data.created_at || new Date().toISOString(),
    status: 'done',
    entities: data.entities || data.extracted_entities || [],
    source_type: data.source_type || 'audio',
    diarized: Boolean(data.diarized),
    segments: data.segments || [],
    speakers: data.speakers || null,
  };
  STATE.transcriptionHistory.push(entry);
  return entry;
}

function cleanupDetailMedia() {
  if (detailMediaUrl) {
    URL.revokeObjectURL(detailMediaUrl);
    detailMediaUrl = null;
  }
  const video = document.getElementById('detailVideo');
  const audio = document.getElementById('detailAudio');
  if (video) {
    video.pause();
    video.removeAttribute('src');
    video.classList.add('hidden');
  }
  if (audio) {
    audio.pause();
    audio.removeAttribute('src');
    audio.classList.add('hidden');
  }
}

function getActivePlayer() {
  const video = document.getElementById('detailVideo');
  if (video && !video.classList.contains('hidden')) return video;
  return document.getElementById('detailAudio');
}

function renderDetailSegments(data) {
  const container = document.getElementById('detailSegments');
  if (!container) return;

  const items = (data.speakers?.length ? data.speakers : data.segments) || [];
  if (!items.length) {
    container.innerHTML = '<div class="empty">Sem segmentos com timestamp.</div>';
    return;
  }

  container.innerHTML = items.map((seg, idx) => {
    const speakerHtml = seg.speaker
      ? `<span class="segment-speaker">${escapeHtml(seg.speaker)}</span>`
      : '';
    const ts = formatSegmentTime(seg.start);
    return `<button type="button" class="segment-row" data-segment-index="${idx}" data-start="${seg.start}">
      <div class="segment-row-top">
        <span class="segment-time">${escapeHtml(ts)}</span>
        ${speakerHtml}
      </div>
      <span class="segment-text">${escapeHtml(seg.text)}</span>
    </button>`;
  }).join('');
}

function renderDetailModal(data) {
  activeDetailId = data.id;
  activeDetailData = data;

  const modal = document.getElementById('transcriptionDetailModal');
  const title = document.getElementById('detailTitle');
  const meta = document.getElementById('detailMeta');
  const textEl = document.getElementById('detailText');
  const mediaWrap = document.getElementById('detailMediaWrap');

  if (title) {
    title.textContent = data.audio_filename || 'Transcrição';
  }

  if (meta) {
    const parts = [
      formatTime(data.created_at),
      data.source_type === 'video' ? 'Vídeo' : 'Áudio',
      data.diarized ? 'Com falantes' : null,
    ].filter(Boolean);
    meta.textContent = parts.join(' · ');
  }

  renderDetailSegments(data);

  if (textEl) {
    textEl.textContent = data.text || '';
    textEl.classList.toggle('hidden', Boolean((data.speakers?.length || data.segments?.length)));
  }

  cleanupDetailMedia();

  const video = document.getElementById('detailVideo');
  const audio = document.getElementById('detailAudio');

  if (data.has_media) {
    mediaWrap?.classList.remove('hidden');
    fetchMediaObjectUrl(data.id)
      .then((url) => {
        detailMediaUrl = url;
        const isVideo = data.source_type === 'video';
        if (isVideo && video) {
          video.src = url;
          video.classList.remove('hidden');
          audio?.classList.add('hidden');
        } else if (audio) {
          audio.src = url;
          audio.classList.remove('hidden');
          video?.classList.add('hidden');
        }
      })
      .catch(() => {
        mediaWrap?.classList.add('hidden');
      });
  } else {
    mediaWrap?.classList.add('hidden');
  }

  modal?.classList.remove('hidden');
  modal?.setAttribute('aria-hidden', 'false');
}

export function closeTranscriptionDetail() {
  cleanupDetailMedia();
  activeDetailId = null;
  activeDetailData = null;
  const modal = document.getElementById('transcriptionDetailModal');
  modal?.classList.add('hidden');
  modal?.setAttribute('aria-hidden', 'true');
}

export async function openTranscriptionDetail(id) {
  try {
    const data = await apiCall(`/api/transcriptions/${id}`);
    renderDetailModal(data);
  } catch (e) {
    toast(e.message, 'error');
  }
}

export async function exportTranscriptionDetail(format) {
  if (!activeDetailId) return;
  try {
    await downloadTranscriptionExport(activeDetailId, format);
    toast(`Exportado como ${format.toUpperCase()}.`, 'success');
  } catch (e) {
    toast(e.message, 'error');
  }
}

export async function copyTranscriptionDetail() {
  const text = activeDetailData?.text;
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    toast('Transcrição copiada.', 'success');
  } catch (e) {
    toast('Não foi possível copiar.', 'error');
  }
}

export function seekToSegment(start) {
  const player = getActivePlayer();
  if (!player) return;
  player.currentTime = Number(start) || 0;
  player.play().catch(() => {});
}

export async function loadTranscriptionHistory() {
  try {
    const rows = await apiCall('/api/transcriptions');
    const list = Array.isArray(rows) ? rows.slice().reverse() : [];
    STATE.transcriptionHistory = list.map(row => ({
      id: row.id,
      text: row.text_preview || row.text || '(sem texto)',
      createdAt: row.created_at,
      status: 'done',
      entities: [],
      source_type: row.source_type || 'audio',
      diarized: Boolean(row.diarized),
    }));

    const container = historyEl();
    if (!container) return;
    container.querySelectorAll('.transcription-entry').forEach(el => el.remove());
    STATE.transcriptionHistory.forEach(entry => appendEntryToDom(entry));
    updateEmptyState();
    scrollHistoryToBottom();
  } catch (e) {
    console.error('Erro ao carregar transcrições:', e);
  }
}

export async function copyTranscriptionEntry(entryEl) {
  const id = entryEl?.dataset?.entryId;
  if (id && !id.startsWith('pending-')) {
    try {
      const data = await apiCall(`/api/transcriptions/${id}`);
      await navigator.clipboard.writeText(data.text || '');
      toast('Transcrição copiada.', 'success');
      return;
    } catch (_) { /* fallback below */ }
  }

  const textEl = entryEl?.querySelector('.transcription-entry-text');
  const text = textEl?.textContent?.trim();
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    toast('Transcrição copiada.', 'success');
  } catch (e) {
    toast('Não foi possível copiar.', 'error');
  }
}

export async function toggleRecording() {
  if (STATE.recording) { stopRecording(); return; }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    STATE.audioChunks = [];
    STATE.mediaRecorder = new MediaRecorder(stream);
    STATE.mediaRecorder.ondataavailable = e => { if (e.data.size > 0) STATE.audioChunks.push(e.data); };
    STATE.mediaRecorder.onstop = async () => {
      const blob = new Blob(STATE.audioChunks, { type: 'audio/webm' });
      await sendTranscription(blob, 'recording.webm');
      stream.getTracks().forEach(t => t.stop());
    };
    STATE.mediaRecorder.start();
    STATE.recording = true;
    document.getElementById('micButton').classList.add('recording');
    document.getElementById('recStatus').textContent = 'Gravando... toque para parar';
    drawWave(stream);
  } catch (e) {
    toast('Não foi possível acessar o microfone: ' + e.message, 'error');
  }
}

function stopRecording() {
  if (STATE.mediaRecorder && STATE.mediaRecorder.state !== 'inactive') {
    STATE.mediaRecorder.stop();
  }
  STATE.recording = false;
  document.getElementById('micButton').classList.remove('recording');
  document.getElementById('recStatus').textContent = 'Processando...';
}

function drawWave(stream) {
  try {
    const canvas = document.getElementById('waveform');
    const c2d = canvas.getContext('2d');
    if (!waveCtx) waveCtx = new (window.AudioContext || window.webkitAudioContext)();
    const source = waveCtx.createMediaStreamSource(stream);
    const analyser = waveCtx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    c2d.scale(dpr, dpr);

    function tick() {
      if (!STATE.recording) return;
      analyser.getByteTimeDomainData(data);
      c2d.fillStyle = getCss('--bg');
      c2d.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
      c2d.lineWidth = 2;
      c2d.strokeStyle = getCss('--cyan');
      c2d.beginPath();
      const slice = canvas.clientWidth / data.length;
      let x = 0;
      for (let i = 0; i < data.length; i++) {
        const v = data[i] / 128.0;
        const y = (v * canvas.clientHeight) / 2;
        if (i === 0) c2d.moveTo(x, y); else c2d.lineTo(x, y);
        x += slice;
      }
      c2d.stroke();
      waveAnim = requestAnimationFrame(tick);
    }
    tick();
  } catch (e) { console.warn('waveform draw failed', e); }
}

function isVideoFile(filename) {
  return /\.(mp4|mkv|webm|avi|mov|m4v|wmv|flv|mpeg|mpg)$/i.test(filename || '');
}

export async function uploadFile(file) {
  if (!file) return;
  await sendTranscription(file, file.name);
}

async function sendTranscription(blob, filename) {
  const pendingId = addPendingEntry(isVideoFile(filename));
  try {
    const fd = new FormData();
    fd.append('file', blob, filename);

    const diarizeEl = document.getElementById('diarizeCheckbox');
    if (diarizeEl?.checked) {
      fd.append('diarize', 'true');
    }

    const data = await apiCall('/api/transcribe', { method: 'POST', body: fd });
    const entry = pushHistoryEntry(data);
    appendEntryToDom(entry, pendingId);
    const recStatus = document.getElementById('recStatus');
    if (recStatus) recStatus.textContent = 'Toque para gravar';
  } catch (e) {
    appendEntryToDom({
      id: pendingId,
      text: '',
      createdAt: new Date().toISOString(),
      status: 'error',
      error: e.message,
    }, pendingId);
    const recStatus = document.getElementById('recStatus');
    if (recStatus) recStatus.textContent = 'Toque para gravar';
    toast(e.message, 'error');
  } finally {
    STATE.pendingTranscriptionId = null;
  }
}

function renderRecorderPage() {
  const container = getContentContainer();
  if (!container) return;

  container.innerHTML = `
    <div class="panel" style="height:100%;">
      <div class="panel-header">
        <span class="panel-title">Áudio e Vídeo</span>
      </div>
      <div class="panel-body scroll recorder-panel-body">
        <div class="recorder">
          <button type="button" id="micButton" class="mic-button">
            <svg viewBox="0 0 24 24"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z"/></svg>
          </button>
          <div class="rec-status" id="recStatus">Toque para gravar</div>
          <canvas class="waveform" id="waveform"></canvas>
          <div class="file-upload">
            <label for="audioFile">📁 Enviar áudio ou vídeo</label>
            <input type="file" id="audioFile" accept="audio/*,video/*" />
          </div>
          <label class="diarize-option">
            <input type="checkbox" id="diarizeCheckbox" />
            Identificar falantes (pyannote)
          </label>
        </div>
        <section class="transcription-history-wrap">
          <div class="transcription-history-header">
            <span class="panel-title">Transcrições</span>
          </div>
          <div class="transcription-history scroll" id="transcriptionHistory">
            <div class="empty" id="transcriptionEmpty">Nenhuma transcrição ainda.</div>
          </div>
        </section>
      </div>
    </div>

    <div id="transcriptionDetailModal" class="modal hidden" aria-hidden="true">
      <div class="modal-backdrop" data-action="close-detail"></div>
      <div class="modal-content transcription-detail">
        <div class="modal-header">
          <h2 id="detailTitle">Transcrição</h2>
          <button type="button" class="btn btn-ghost btn-sm" data-action="close-detail">✕</button>
        </div>
        <div class="modal-body scroll">
          <div id="detailMediaWrap" class="detail-media-wrap hidden">
            <video id="detailVideo" controls class="detail-player hidden"></video>
            <audio id="detailAudio" controls class="detail-player hidden"></audio>
          </div>
          <div id="detailMeta" class="detail-meta"></div>
          <div class="detail-export-actions">
            <button type="button" class="btn btn-ghost btn-sm" data-action="export" data-format="txt">TXT</button>
            <button type="button" class="btn btn-ghost btn-sm" data-action="export" data-format="json">JSON</button>
            <button type="button" class="btn btn-ghost btn-sm" data-action="export" data-format="srt">SRT</button>
            <button type="button" class="btn btn-ghost btn-sm" data-action="copy-detail">Copiar</button>
          </div>
          <div id="detailSegments" class="detail-segments"></div>
          <div id="detailText" class="detail-text hidden"></div>
        </div>
      </div>
    </div>
  `;

  bindRecorderEvents();
}

function bindRecorderEvents() {
  const container = getContentContainer();
  if (!container) return;

  container.querySelector('#micButton')?.addEventListener('click', toggleRecording);

  const fileInput = container.querySelector('#audioFile');
  if (fileInput) {
    fileInput.addEventListener('change', e => {
      uploadFile(e.target.files[0]);
      e.target.value = '';
    });
  }

  container.querySelector('#transcriptionHistory')?.addEventListener('click', e => {
    const entry = e.target.closest('.transcription-entry');
    if (!entry) return;

    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const { action } = btn.dataset;
    if (action === 'copy-transcription') copyTranscriptionEntry(entry);
    if (action === 'open-detail') openTranscriptionDetail(entry.dataset.entryId);
  });

  container.querySelector('#transcriptionDetailModal')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const { action, format } = btn.dataset;
    if (action === 'close-detail') closeTranscriptionDetail();
    if (action === 'export') exportTranscriptionDetail(format);
    if (action === 'copy-detail') copyTranscriptionDetail();
  });

  container.querySelector('#detailSegments')?.addEventListener('click', e => {
    const row = e.target.closest('.segment-row');
    if (!row) return;
    seekToSegment(row.dataset.start);
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeTranscriptionDetail();
  });
}

export async function initRecorder() {
  renderRecorderPage();
  await loadTranscriptionHistory();
}
