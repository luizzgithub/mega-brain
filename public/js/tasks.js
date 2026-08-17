import { apiCall } from './api.js';
import { escapeHtml, toast } from './utils.js';

let tasksCache = [];
let projectsCache = [];

const STATUS_LABELS = {
  todo: 'A Fazer',
  in_progress: 'Em Progresso',
  done: 'Concluído',
  blocked: 'Bloqueado',
};

const PRIORITY_LABELS = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
};

export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export function statusLabel(status) {
  return STATUS_LABELS[status] || status;
}

export function priorityLabel(priority) {
  return PRIORITY_LABELS[priority] || priority;
}

export function getTasksCache() {
  return tasksCache;
}

export function getProjectsCache() {
  return projectsCache;
}

export async function loadTasks(projectId = null) {
  try {
    const url = projectId ? `/api/tasks?project_id=${encodeURIComponent(projectId)}` : '/api/tasks';
    tasksCache = await apiCall(url) || [];
    return tasksCache;
  } catch (e) {
    toast(e.message, 'error');
    return [];
  }
}

export async function loadProjects() {
  try {
    projectsCache = await apiCall('/api/projects') || [];
    return projectsCache;
  } catch (e) {
    return [];
  }
}

export async function createTask(body) {
  const data = await apiCall('/api/tasks', { method: 'POST', body });
  return data;
}

export async function updateTask(id, body) {
  const data = await apiCall(`/api/tasks/${id}`, { method: 'PATCH', body });
  return data;
}

export async function deleteTask(id) {
  await apiCall(`/api/tasks/${id}`, { method: 'DELETE' });
}

export function projectOptions(selectedId = '') {
  return projectsCache.map(p =>
    `<option value="${escapeHtml(p.id)}"${p.id === selectedId ? ' selected' : ''}>${escapeHtml(p.name)}</option>`
  ).join('');
}

export function taskCardHtml(task) {
  const priorityClass = `priority-${escapeHtml(task.priority || 'medium')}`;
  return `
    <div class="card ${priorityClass}" data-task-id="${escapeHtml(task.id)}">
      <div class="card-title">${escapeHtml(task.title)}</div>
      <div class="card-desc">${escapeHtml(task.description || '')}</div>
      <div class="card-meta">${statusLabel(task.status)} · ${priorityLabel(task.priority)} · ${formatDate(task.due_date)}</div>
    </div>
  `;
}

export function renderTaskForm(containerSelector, task = null, onSave) {
  const container = document.querySelector(containerSelector);
  if (!container) return;

  const isEdit = Boolean(task);
  container.innerHTML = `
    <form id="taskForm" class="modal-form" onsubmit="return false;">
      <input type="hidden" id="taskId" value="${isEdit ? escapeHtml(task.id) : ''}" />
      <div>
        <label for="taskTitle">Título</label>
        <input type="text" id="taskTitle" value="${isEdit ? escapeHtml(task.title) : ''}" required />
      </div>
      <div>
        <label for="taskProject">Projeto</label>
        <select id="taskProject">
          <option value="">Sem projeto</option>
          ${projectOptions(isEdit ? task.project_id : '')}
        </select>
      </div>
      <div>
        <label for="taskDescription">Descrição</label>
        <textarea id="taskDescription" rows="3">${isEdit ? escapeHtml(task.description || '') : ''}</textarea>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div>
          <label for="taskStatus">Status</label>
          <select id="taskStatus">
            <option value="todo"${isEdit && task.status === 'todo' ? ' selected' : ''}>A Fazer</option>
            <option value="in_progress"${isEdit && task.status === 'in_progress' ? ' selected' : ''}>Em Progresso</option>
            <option value="done"${isEdit && task.status === 'done' ? ' selected' : ''}>Concluído</option>
            <option value="blocked"${isEdit && task.status === 'blocked' ? ' selected' : ''}>Bloqueado</option>
          </select>
        </div>
        <div>
          <label for="taskPriority">Prioridade</label>
          <select id="taskPriority">
            <option value="low"${isEdit && task.priority === 'low' ? ' selected' : ''}>Baixa</option>
            <option value="medium"${isEdit && task.priority === 'medium' ? ' selected' : ''}>Média</option>
            <option value="high"${isEdit && task.priority === 'high' ? ' selected' : ''}>Alta</option>
          </select>
        </div>
      </div>
      <div>
        <label for="taskDueDate">Data de vencimento</label>
        <input type="date" id="taskDueDate" value="${isEdit && task.due_date ? escapeHtml(task.due_date.slice(0, 10)) : ''}" />
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost btn-sm" data-action="close-task-form">Cancelar</button>
        <button type="submit" class="btn btn-primary btn-sm">Salvar</button>
      </div>
    </form>
  `;

  container.querySelector('#taskForm')?.addEventListener('submit', e => {
    e.preventDefault();
    const body = {
      project_id: document.getElementById('taskProject').value || null,
      title: document.getElementById('taskTitle').value.trim(),
      description: document.getElementById('taskDescription').value.trim() || null,
      status: document.getElementById('taskStatus').value,
      priority: document.getElementById('taskPriority').value,
      due_date: document.getElementById('taskDueDate').value || null,
    };
    onSave(body);
  });

  container.querySelector('[data-action="close-task-form"]')?.addEventListener('click', () => {
    container.innerHTML = '';
  });
}
