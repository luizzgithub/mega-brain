import { STATE } from './state.js';
import { apiCall } from './api.js';
import { updateUserDisplay } from './shell.js';
import { loadBriefing } from './briefing.js';
import { loadReminders } from './reminders.js';
import { loadSuggestions } from './suggestions.js';
import { loadTranscriptionHistory } from './transcription.js';

export async function loadDashboard() {
  try { await loadBriefing(); } catch (e) { console.error(e); }
  try { await loadReminders(); } catch (e) { console.error(e); }
  try { await loadSuggestions(); } catch (e) { console.error(e); }
  try { await loadTranscriptionHistory(); } catch (e) { console.error(e); }
  try { await loadUserFromApi(); } catch (e) { /* fallback to JWT already stored */ }
}

export async function loadUserFromApi() {
  const me = await apiCall('/api/auth/me');
  if (me && (me.name || me.email)) {
    STATE.user = { ...(STATE.user || {}), ...me };
    localStorage.setItem('mc_user', JSON.stringify(STATE.user));
    updateUserDisplay();
  }
}
