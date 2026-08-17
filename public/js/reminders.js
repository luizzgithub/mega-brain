import { apiCall } from './api.js';
import { toast, escapeHtml } from './utils.js';

export async function loadReminders() {
  const el = document.getElementById('remindersBody');
  el.innerHTML = '<div class="empty">Carregando...</div>';
  try {
    const data = await apiCall('/api/reminders');
    const list = Array.isArray(data) ? data : (data.reminders || data.items || []);
    if (!list.length) { el.innerHTML = '<div class="empty">Nenhum lembrete.</div>'; return; }
    el.innerHTML = list.map(r => {
      const status = (r.status || 'pending').toLowerCase();
      const id = escapeHtml(String(r.id));
      return `<div class="card">
        <div class="card-title">${escapeHtml(r.title || 'Sem título')}</div>
        <div class="card-meta">${escapeHtml(r.due_date || r.dueDate || '')}</div>
        <span class="status-badge status-${escapeHtml(status)}">${escapeHtml(status)}</span>
        <div class="card-actions" style="margin-top:8px;">
          ${status !== 'done' ? `<button type="button" class="btn btn-ghost btn-sm" data-action="reminder-done" data-id="${id}">Concluir</button>` : ''}
        </div>
      </div>`;
    }).join('');
  } catch (e) {
    el.innerHTML = '<div class="empty">⚠ ' + escapeHtml(e.message) + '</div>';
  }
}

export async function toggleReminder(id, status) {
  try {
    await apiCall('/api/reminders/' + id, { method: 'PATCH', body: { status } });
    toast('Lembrete atualizado.', 'success');
    loadReminders();
  } catch (e) { toast(e.message, 'error'); }
}
