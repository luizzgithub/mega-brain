import { apiCall } from './api.js';
import { escapeHtml } from './utils.js';
import { getContentContainer } from './shell.js';
import { loadReminders, toggleReminder } from './reminders.js';
import { loadSuggestions, updateSuggestion } from './suggestions.js';

export async function loadBriefing() {
  try {
    const data = await apiCall('/api/briefing');
    const text = (data && (data.summary || data.text || data.briefing || data.content)) || 'Sem briefing disponível.';
    const el = document.getElementById('briefingBody');
    if (el) el.innerHTML = '<div class="card"><div class="card-desc">' + escapeHtml(text) + '</div></div>';
  } catch (e) {
    const el = document.getElementById('briefingBody');
    if (el) el.innerHTML = '<div class="empty">⚠ ' + escapeHtml(e.message) + '</div>';
  }
}

function renderBriefingPage() {
  const container = getContentContainer();
  if (!container) return;

  container.innerHTML = `
    <div class="briefing-grid">
      <div class="panel briefing-main">
        <div class="panel-header">
          <span class="panel-title">Briefing do Dia</span>
          <button type="button" id="refreshBriefingBtn" class="btn btn-ghost btn-sm">↻</button>
        </div>
        <div class="panel-body scroll" id="briefingBody"></div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <span class="panel-title">Lembretes</span>
          <button type="button" id="refreshRemindersBtn" class="btn btn-ghost btn-sm">↻</button>
        </div>
        <div class="panel-body scroll" id="remindersBody"></div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <span class="panel-title">Sugestões</span>
          <button type="button" id="refreshSuggestionsBtn" class="btn btn-ghost btn-sm">↻</button>
        </div>
        <div class="panel-body scroll" id="suggestionsBody"></div>
      </div>
    </div>
  `;

  container.querySelector('#refreshBriefingBtn')?.addEventListener('click', loadBriefing);
  container.querySelector('#refreshRemindersBtn')?.addEventListener('click', loadReminders);
  container.querySelector('#refreshSuggestionsBtn')?.addEventListener('click', loadSuggestions);

  container.querySelector('#remindersBody')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-action="reminder-done"]');
    if (!btn) return;
    toggleReminder(btn.dataset.id, 'done');
  });

  container.querySelector('#suggestionsBody')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;
    if (action === 'suggestion-done') updateSuggestion(id, 'done');
    if (action === 'suggestion-dismiss') updateSuggestion(id, 'dismissed');
  });
}

export async function initBriefing() {
  renderBriefingPage();
  await loadBriefing();
  await loadReminders();
  await loadSuggestions();
}
