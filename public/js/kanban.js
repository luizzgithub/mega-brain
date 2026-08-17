import { toast, escapeHtml } from './utils.js';
import { getContentContainer } from './shell.js';
import {
  loadTasks,
  loadProjects,
  updateTask,
  deleteTask,
  createTask,
  getTasksCache,
  getProjectsCache,
  statusLabel,
  priorityLabel,
  formatDate,
  renderTaskForm,
} from './tasks.js';

const COLUMNS = [
  { id: 'todo', label: 'A Fazer' },
  { id: 'in_progress', label: 'Em Progresso' },
  { id: 'done', label: 'Concluído' },
];

let currentFilterProjectId = '';
let draggedTaskId = null;

function renderKanbanPage() {
  const container = getContentContainer();
  if (!container) return;

  container.innerHTML = `
    <div class="page-toolbar">
      <button type="button" id="newTaskBtn" class="btn btn-primary btn-sm">+ Nova Task</button>
      <select id="projectFilter">
        <option value="">Todos os projetos</option>
      </select>
    </div>
    <div class="kanban-scroll">
      <div id="kanbanBoard" class="kanban-board">
      ${COLUMNS.map(col => `
        <div class="kanban-column" data-status="${col.id}">
          <div class="kanban-column-header">
            <span>${col.label}</span>
            <span class="column-count" id="count-${col.id}">0</span>
          </div>
          <div class="kanban-column-body scroll" data-status="${col.id}"></div>
        </div>
      `).join('')}
      </div>
    </div>

    <div id="taskModal" class="modal hidden" aria-hidden="true">
      <div class="modal-backdrop" data-action="close-task-modal"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h2 id="taskModalTitle">Nova Task</h2>
          <button type="button" class="btn btn-ghost btn-sm" data-action="close-task-modal">✕</button>
        </div>
        <div class="modal-body" id="taskModalBody"></div>
      </div>
    </div>
  `;

  bindKanbanEvents();
}

function bindKanbanEvents() {
  const container = getContentContainer();
  if (!container) return;

  container.querySelector('#newTaskBtn')?.addEventListener('click', openNewTaskModal);
  container.querySelector('#projectFilter')?.addEventListener('change', e => {
    currentFilterProjectId = e.target.value;
    refreshBoard();
  });

  container.querySelector('#taskModal')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-action="close-task-modal"], .modal-backdrop');
    if (btn) closeTaskModal();
  });

  COLUMNS.forEach(col => {
    const body = container.querySelector(`.kanban-column-body[data-status="${col.id}"]`);
    if (!body) return;

    body.addEventListener('dragover', e => {
      e.preventDefault();
      body.classList.add('drag-over');
    });

    body.addEventListener('dragleave', () => {
      body.classList.remove('drag-over');
    });

    body.addEventListener('drop', async e => {
      e.preventDefault();
      body.classList.remove('drag-over');
      if (!draggedTaskId) return;
      const newStatus = body.dataset.status;
      try {
        await updateTask(draggedTaskId, { status: newStatus });
        toast('Task movida.', 'success');
        await refreshBoard();
      } catch (err) {
        toast(err.message, 'error');
      }
      draggedTaskId = null;
    });
  });

  container.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;
    if (action === 'edit-task') openEditTaskModal(id);
    if (action === 'delete-task') removeTask(id);
  });

  container.addEventListener('dragstart', e => {
    const card = e.target.closest('.kanban-card');
    if (card) {
      draggedTaskId = card.dataset.taskId;
      card.classList.add('dragging');
      e.dataTransfer?.setData('text/plain', draggedTaskId);
    }
  });

  container.addEventListener('dragend', e => {
    const card = e.target.closest('.kanban-card');
    if (card) card.classList.remove('dragging');
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeTaskModal();
  });
}

function taskCardHtml(task) {
  const projectName = task.project_name || 'Sem projeto';
  return `
    <div class="kanban-card" draggable="true" data-task-id="${escapeHtml(task.id)}">
      <div class="kanban-card-title">${escapeHtml(task.title)}</div>
      ${task.description ? `<div style="font-size:12px;color:var(--muted);margin-bottom:4px;">${escapeHtml(task.description)}</div>` : ''}
      <div class="kanban-card-meta">
        <span>${escapeHtml(projectName)}</span>
        <span>${priorityLabel(task.priority)} · ${formatDate(task.due_date)}</span>
      </div>
      <div class="card-actions" style="margin-top:8px;">
        <button type="button" class="btn btn-ghost btn-sm" data-action="edit-task" data-id="${escapeHtml(task.id)}">Editar</button>
        <button type="button" class="btn btn-ghost btn-sm" data-action="delete-task" data-id="${escapeHtml(task.id)}">Excluir</button>
      </div>
    </div>
  `;
}

function filterTasks() {
  const tasks = getTasksCache();
  if (!currentFilterProjectId) return tasks;
  return tasks.filter(t => t.project_id === currentFilterProjectId);
}

async function refreshBoard() {
  await loadTasks();
  const filtered = filterTasks();

  COLUMNS.forEach(col => {
    const body = document.querySelector(`.kanban-column-body[data-status="${col.id}"]`);
    const count = document.getElementById(`count-${col.id}`);
    const colTasks = filtered.filter(t => t.status === col.id);
    if (body) body.innerHTML = colTasks.map(taskCardHtml).join('') || '<div class="empty">Nenhuma task</div>';
    if (count) count.textContent = colTasks.length;
  });

  const projectFilter = document.getElementById('projectFilter');
  if (projectFilter && !projectFilter.dataset.populated) {
    const projects = getProjectsCache();
    projectFilter.innerHTML = '<option value="">Todos os projetos</option>' +
      projects.map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`).join('');
    projectFilter.value = currentFilterProjectId;
    projectFilter.dataset.populated = 'true';
  }
}

function openNewTaskModal() {
  document.getElementById('taskModalTitle').textContent = 'Nova Task';
  const body = document.getElementById('taskModalBody');
  renderTaskForm('#taskModalBody', null, async taskBody => {
    try {
      await createTask(taskBody);
      toast('Task criada.', 'success');
      closeTaskModal();
      await refreshBoard();
    } catch (e) {
      toast(e.message, 'error');
    }
  });
  document.getElementById('taskModal').classList.remove('hidden');
  document.getElementById('taskModal').setAttribute('aria-hidden', 'false');
}

function openEditTaskModal(id) {
  const task = getTasksCache().find(t => t.id === id);
  if (!task) return;
  document.getElementById('taskModalTitle').textContent = 'Editar Task';
  renderTaskForm('#taskModalBody', task, async taskBody => {
    try {
      await updateTask(id, taskBody);
      toast('Task atualizada.', 'success');
      closeTaskModal();
      await refreshBoard();
    } catch (e) {
      toast(e.message, 'error');
    }
  });
  document.getElementById('taskModal').classList.remove('hidden');
  document.getElementById('taskModal').setAttribute('aria-hidden', 'false');
}

function closeTaskModal() {
  const modal = document.getElementById('taskModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
  }
  const body = document.getElementById('taskModalBody');
  if (body) body.innerHTML = '';
}

async function removeTask(id) {
  const task = getTasksCache().find(t => t.id === id);
  if (!task) return;
  if (!confirm(`Excluir a task "${task.title}"?`)) return;
  try {
    await deleteTask(id);
    toast('Task removida.', 'success');
    await refreshBoard();
  } catch (e) {
    toast(e.message, 'error');
  }
}

async function initKanban() {
  const params = new URLSearchParams(window.location.search);
  currentFilterProjectId = params.get('project_id') || '';
  await loadProjects();
  renderKanbanPage();
  await refreshBoard();
}

export { initKanban };
