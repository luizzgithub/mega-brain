import { STATE } from './state.js';
import { apiCall } from './api.js';
import { toast } from './utils.js';
import { getContentContainer } from './shell.js';

function appendMessage(role, text) {
  const box = document.getElementById('chatMessages');
  if (!box) return;
  const div = document.createElement('div');
  div.className = 'message ' + role;
  div.textContent = text;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

async function sendChat() {
  const input = document.getElementById('chatInput');
  if (!input) return;
  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';
  appendMessage('user', msg);
  try {
    const body = { message: msg };
    if (STATE.conversationId) body.conversation_id = STATE.conversationId;
    const data = await apiCall('/api/chat', { method: 'POST', body });
    if (data && data.conversation_id) STATE.conversationId = data.conversation_id;
    appendMessage('assistant', (data && (data.response || data.message || data.answer)) || 'Sem resposta.');
  } catch (e) {
    appendMessage('assistant', '⚠ ' + e.message);
    toast(e.message, 'error');
  }
}

function newChat() {
  STATE.conversationId = null;
  const box = document.getElementById('chatMessages');
  if (box) box.innerHTML = '';
}

function renderChatPage() {
  const container = getContentContainer();
  if (!container) return;

  container.innerHTML = `
    <div class="panel" id="chatPanel" style="height:100%;">
      <div class="panel-header">
        <span class="panel-title">Mega Cérebro Assistant</span>
        <button type="button" id="newChatBtn" class="btn btn-ghost btn-sm">Novo Chat</button>
      </div>
      <div class="panel-body scroll" id="chatMessages"></div>
      <div class="chat-input-row">
        <input type="text" id="chatInput" placeholder="Pergunte algo..." />
        <button type="button" id="sendChatBtn" class="btn btn-primary btn-sm">Enviar</button>
      </div>
    </div>
  `;

  container.querySelector('#newChatBtn')?.addEventListener('click', newChat);
  container.querySelector('#sendChatBtn')?.addEventListener('click', sendChat);
  container.querySelector('#chatInput')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') sendChat();
  });
}

export async function initChat() {
  renderChatPage();
}
