import { STATE } from './state.js';
import { redirectToLogin, logout } from './auth.js';
import { renderShell, updateUserDisplay } from './shell.js';
import { loadUserFromApi } from './dashboard.js';
import { initChat } from './chat.js';
import { initRecorder } from './transcription.js';
import { initBriefing } from './briefing.js';
import { initProjects } from './projects.js';
import { initKanban } from './kanban.js';

const PAGE_INIT = {
  chat: initChat,
  recorder: initRecorder,
  briefing: initBriefing,
  projects: initProjects,
  kanban: initKanban,
};

function currentPageId() {
  const bodyPage = document.body.dataset.page;
  if (bodyPage && bodyPage !== 'index') return bodyPage;
  const path = window.location.pathname;
  const map = {
    '/chat.html': 'chat',
    '/recorder.html': 'recorder',
    '/briefing.html': 'briefing',
    '/projects.html': 'projects',
    '/kanban.html': 'kanban',
  };
  return map[path] || null;
}

async function boot() {
  if (!STATE.token) {
    redirectToLogin(window.location.pathname + window.location.search);
    return;
  }

  try {
    await loadUserFromApi();
  } catch (e) {
    logout();
    return;
  }

  const pageId = currentPageId();
  if (pageId) {
    renderShell(pageId);
    updateUserDisplay();

    const initFn = PAGE_INIT[pageId];
    if (initFn) {
      try {
        await initFn();
      } catch (e) {
        console.error(`Erro ao inicializar página ${pageId}:`, e);
      }
    }
  } else {
    window.location.replace('/chat.html');
  }
}

window.addEventListener('DOMContentLoaded', boot);
