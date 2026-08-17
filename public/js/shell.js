import { STATE } from './state.js';
import { logout } from './auth.js';

const ICONS = {
  chat: '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>',
  recorder: '<svg viewBox="0 0 24 24"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z"/></svg>',
  briefing: '<svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>',
  projects: '<svg viewBox="0 0 24 24"><path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/></svg>',
  kanban: '<svg viewBox="0 0 24 24"><path d="M3 3h8v10H3V3zm10 0h8v6h-8V3zM3 15h8v6H3v-6zm10 10h-8v-6h8v6zm10-10h-8v10h8V15z"/></svg>',
  user: '<svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>',
  menu: '<svg viewBox="0 0 24 24"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>',
  logo: '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>',
};

const PAGES = [
  { id: 'chat', label: 'Chat', icon: 'chat', path: '/chat.html' },
  { id: 'recorder', label: 'Recorder', icon: 'recorder', path: '/recorder.html' },
  { id: 'briefing', label: 'Briefing', icon: 'briefing', path: '/briefing.html' },
  { id: 'projects', label: 'Projetos', icon: 'projects', path: '/projects.html' },
  { id: 'kanban', label: 'Tasks/Kanban', icon: 'kanban', path: '/kanban.html' },
];

export function renderShell(activePageId) {
  const root = document.getElementById('appShell');
  if (!root) return;

  const currentPath = window.location.pathname;
  const activeId = activePageId || PAGES.find(p => currentPath.endsWith(p.path))?.id || 'chat';

  root.innerHTML = `
    <div class="sidebar-overlay" id="sidebarOverlay"></div>
    <div class="app-shell">
      <aside class="app-sidebar" id="appSidebar">
        <div class="sidebar-brand">
          <div class="brand-icon">${ICONS.logo}</div>
          <div class="brand-text">MEGA CÉREBRO</div>
        </div>
        <nav class="sidebar-nav" id="sidebarNav">
          ${PAGES.map(p => `
            <a href="${p.path}" class="nav-item${p.id === activeId ? ' active' : ''}" data-page="${p.id}">
              ${ICONS[p.icon]}
              <span>${p.label}</span>
            </a>
          `).join('')}
        </nav>
        <div class="sidebar-footer">
          <div class="sidebar-user">
            ${ICONS.user}
            <span id="shellUserName">Usuário</span>
          </div>
          <button type="button" id="shellLogoutBtn" class="btn btn-ghost btn-sm">Sair</button>
        </div>
      </aside>
      <main class="app-main">
        <header class="app-header">
          <div class="header-left">
            <button type="button" id="menuToggle" class="menu-toggle" aria-label="Abrir menu">
              ${ICONS.menu}
            </button>
            <div class="brand">${PAGES.find(p => p.id === activeId)?.label || 'MEGA CÉREBRO'}</div>
          </div>
          <div class="header-right">
            <span class="user-name" id="headerUserName">Usuário</span>
          </div>
        </header>
        <div class="app-content" id="appContent"></div>
      </main>
    </div>
  `;

  bindShellEvents();
  updateUserDisplay();
}

export function getContentContainer() {
  return document.getElementById('appContent');
}

export function updateUserDisplay() {
  const name = (STATE.user && (STATE.user.name || STATE.user.email)) || 'Usuário';
  const shellName = document.getElementById('shellUserName');
  const headerName = document.getElementById('headerUserName');
  if (shellName) shellName.textContent = name;
  if (headerName) headerName.textContent = name;
}

function bindShellEvents() {
  const logoutBtn = document.getElementById('shellLogoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }

  const toggle = document.getElementById('menuToggle');
  const sidebar = document.getElementById('appSidebar');
  const overlay = document.getElementById('sidebarOverlay');

  function closeSidebar() {
    sidebar?.classList.remove('open');
    overlay?.classList.remove('visible');
  }

  if (toggle && sidebar) {
    toggle.addEventListener('click', () => {
      const opening = !sidebar.classList.contains('open');
      sidebar.classList.toggle('open');
      overlay?.classList.toggle('visible', opening);
    });

    overlay?.addEventListener('click', closeSidebar);

    sidebar.addEventListener('click', (e) => {
      const link = e.target.closest('.nav-item');
      if (link && window.innerWidth <= 900) {
        closeSidebar();
      }
    });
  }
}
