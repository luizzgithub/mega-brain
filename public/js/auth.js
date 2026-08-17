import { STATE } from './state.js';
import { apiCall } from './api.js';
import { decodeJwt } from './utils.js';

const LOGIN_PATH = '/login.html';
const DEFAULT_APP_PATH = '/chat.html';

export function getReturnTo() {
  const params = new URLSearchParams(window.location.search);
  const returnTo = params.get('returnTo');
  if (!returnTo || !returnTo.startsWith('/') || returnTo.startsWith('//')) {
    return DEFAULT_APP_PATH;
  }
  if (returnTo === LOGIN_PATH || returnTo === '/' || returnTo === '/index.html') {
    return DEFAULT_APP_PATH;
  }
  return returnTo;
}

export function redirectToLogin(returnTo) {
  const current = returnTo || (window.location.pathname + window.location.search);
  if (current.startsWith(LOGIN_PATH)) {
    window.location.replace(LOGIN_PATH);
    return;
  }
  const safe = current.startsWith('/') && !current.startsWith('//') ? current : DEFAULT_APP_PATH;
  window.location.replace(`${LOGIN_PATH}?returnTo=${encodeURIComponent(safe)}`);
}

export function bindAuthEvents() {
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  const submitBtn = document.getElementById('authSubmit');
  if (submitBtn) submitBtn.addEventListener('click', handleAuth);

  const passwordInput = document.getElementById('password');
  if (passwordInput) {
    passwordInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') handleAuth();
    });
  }
}

export function switchTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  document.getElementById('nameGroup').style.display = (tab === 'register') ? 'block' : 'none';
  document.getElementById('authSubmit').textContent = (tab === 'register') ? 'Cadastrar' : 'Entrar';
  document.getElementById('authError').style.display = 'none';
}

export function currentTab() {
  return document.querySelector('.auth-tab.active').dataset.tab;
}

export async function handleAuth() {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const name = document.getElementById('name').value.trim();
  const errEl = document.getElementById('authError');
  errEl.style.display = 'none';

  if (!email || !password) {
    errEl.textContent = 'Preencha email e senha.';
    errEl.style.display = 'block';
    return;
  }
  if (currentTab() === 'register' && !name) {
    errEl.textContent = 'Informe seu nome.';
    errEl.style.display = 'block';
    return;
  }

  try {
    const endpoint = (currentTab() === 'register') ? '/api/auth/register' : '/api/auth/login';
    const body = (currentTab() === 'register') ? { email, password, name } : { email, password };
    const data = await apiCall(endpoint, { method: 'POST', body });
    STATE.token = data.token || data.accessToken || data.access_token;
    if (!STATE.token) throw new Error('Token não retornado pelo servidor.');
    localStorage.setItem('mc_token', STATE.token);
    const userData = data.user || decodeJwt(STATE.token);
    STATE.user = userData;
    localStorage.setItem('mc_user', JSON.stringify(userData));
    window.location.replace(getReturnTo());
  } catch (e) {
    errEl.textContent = e.message;
    errEl.style.display = 'block';
  }
}

export function logout() {
  STATE.token = null;
  STATE.user = null;
  STATE.conversationId = null;
  localStorage.removeItem('mc_token');
  localStorage.removeItem('mc_user');
  window.location.replace(LOGIN_PATH);
}
