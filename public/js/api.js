import { STATE } from './state.js';

/** HTTP client with auth header and { success, data } unwrap */
export async function apiCall(url, options = {}) {
  const opts = { ...options };
  opts.headers = { ...(opts.headers || {}) };
  if (STATE.token) opts.headers['Authorization'] = 'Bearer ' + STATE.token;
  if (opts.body && typeof opts.body !== 'string' && !(opts.body instanceof FormData)) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(opts.body);
  }
  const res = await fetch(url, opts);
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) {
    const msg = (data && data.error) || (data && data.message) || ('HTTP ' + res.status);
    const isAuthAttempt = url.includes('/api/auth/login') || url.includes('/api/auth/register');
    if (res.status === 401 && !isAuthAttempt) {
      const { logout } = await import('./auth.js');
      logout();
    }
    throw new Error(msg);
  }
  if (data && typeof data === 'object' && data.success === true && 'data' in data) {
    return data.data;
  }
  return data;
}

/** Fetch authenticated media blob and return an object URL */
export async function fetchMediaObjectUrl(transcriptionId) {
  const res = await fetch(`/api/transcriptions/${transcriptionId}/media`, {
    headers: STATE.token ? { Authorization: 'Bearer ' + STATE.token } : {},
  });
  if (!res.ok) {
    throw new Error('Mídia não disponível');
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

/** Download transcription export (txt/json/srt) */
export async function downloadTranscriptionExport(transcriptionId, format) {
  const res = await fetch(`/api/transcriptions/${transcriptionId}/export?format=${format}`, {
    headers: STATE.token ? { Authorization: 'Bearer ' + STATE.token } : {},
  });
  if (!res.ok) {
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const err = await res.json();
      throw new Error(err.error || 'Falha ao exportar');
    }
    throw new Error('Falha ao exportar');
  }
  const blob = await res.blob();
  const disposition = res.headers.get('content-disposition') || '';
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match ? match[1] : `transcription.${format}`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
