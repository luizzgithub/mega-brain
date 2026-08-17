import { apiCall } from './api.js';
import { toast, escapeHtml } from './utils.js';

export async function loadSuggestions() {
  const el = document.getElementById('suggestionsBody');
  el.innerHTML = '<div class="empty">Carregando...</div>';
  try {
    const data = await apiCall('/api/suggestions?status=pending');
    const list = Array.isArray(data) ? data : (data.suggestions || data.items || []);
    if (!list.length) { el.innerHTML = '<div class="empty">Nenhuma sugestão pendente.</div>'; return; }
    el.innerHTML = list.map(s => {
      const prio = (s.priority || 'low').toLowerCase();
      const icon = s.type === 'reminder' ? '⏰' : (s.type === 'task' ? '✅' : (s.type === 'note' ? '📝' : '💡'));
      const id = escapeHtml(String(s.id));
      return `<div class="card priority-${escapeHtml(prio)}">
        <div class="card-title">${icon} ${escapeHtml(s.title || s.description || 'Sem título')}</div>
        <div class="card-desc">${escapeHtml(s.description || '')}</div>
        <div class="card-meta">${escapeHtml(s.type || '')} · ${escapeHtml(prio)}</div>
        <div class="card-actions">
          <button type="button" class="btn btn-primary btn-sm" data-action="suggestion-done" data-id="${id}">Done</button>
          <button type="button" class="btn btn-ghost btn-sm" data-action="suggestion-dismiss" data-id="${id}">Dismiss</button>
        </div>
      </div>`;
    }).join('');
  } catch (e) {
    el.innerHTML = '<div class="empty">⚠ ' + escapeHtml(e.message) + '</div>';
  }
}

export async function updateSuggestion(id, status) {
  try {
    await apiCall('/api/suggestions/' + id, { method: 'PATCH', body: { status } });
    toast('Sugestão atualizada.', 'success');
    loadSuggestions();
  } catch (e) { toast(e.message, 'error'); }
}
