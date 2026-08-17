import { apiCall } from './api.js';
import { escapeHtml, toast } from './utils.js';
import { getContentContainer } from './shell.js';

let projectsCache = [];
let editingProjectId = null;

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function statusLabel(status) {
  const map = { active: 'Ativo', archived: 'Arquivado', done: 'Concluído' };
  return map[status] || status;
}

function renderProjectsPage() {
  const container = getContentContainer();
  if (!container) return;

  container.innerHTML = `
    <div class="page-toolbar">
      <button type="button" id="newProjectBtn" class="btn btn-primary btn-sm">+ Novo Projeto</button>
    </div>
    <div class="filter-row">
      <input type="text" id="projectSearch" placeholder="Buscar projeto..." />
      <select id="projectStatusFilter">
        <option value="">Todos os status</option>
        <option value="active">Ativo</option>
        <option value="archived">Arquivado</option>
        <option value="done">Concluído</option>
      </select>
    </div>
    <div id="projectsGrid" class="project-grid"></div>

    <div id="projectModal" class="modal hidden" aria-hidden="true">
      <div class="modal-backdrop" data-action="close-project-modal"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h2 id="projectModalTitle">Novo Projeto</h2>
          <button type="button" class="btn btn-ghost btn-sm" data-action="close-project-modal">✕</button>
        </div>
        <div class="modal-body">
          <form id="projectForm" class="modal-form" onsubmit="return false;">
            <div>
              <label for="projectName">Nome</label>
              <input type="text" id="projectName" required />
            </div>
            <div>
              <label for="projectDescription">Descrição</label>
              <textarea id="projectDescription" rows="3"></textarea>
            </div>
            <div>
              <label for="projectStatus">Status</label>
              <select id="projectStatus">
                <option value="active">Ativo</option>
                <option value="archived">Arquivado</option>
                <option value="done">Concluído</option>
              </select>
            </div>
            <div class="modal-actions">
              <button type="button" class="btn btn-ghost btn-sm" data-action="close-project-modal">Cancelar</button>
              <button type="submit" class="btn btn-primary btn-sm">Salvar</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;

  bindProjectEvents();
  filterAndRenderProjects();
}

function bindProjectEvents() {
  const container = getContentContainer();
  if (!container) return;

  container.querySelector('#newProjectBtn')?.addEventListener('click', openNewProjectModal);

  container.querySelector('#projectForm')?.addEventListener('submit', e => {
    e.preventDefault();
    saveProject();
  });

  container.querySelector('#projectSearch')?.addEventListener('input', filterAndRenderProjects);
  container.querySelector('#projectStatusFilter')?.addEventListener('change', filterAndRenderProjects);

  container.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;

    if (action === 'close-project-modal') closeProjectModal();
    if (action === 'edit-project') openEditProjectModal(id);
    if (action === 'delete-project') deleteProject(id);
    if (action === 'view-tasks') window.location.href = `/kanban.html?project_id=${encodeURIComponent(id)}`;
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeProjectModal();
  });
}

function filterProjects() {
  const search = document.getElementById('projectSearch')?.value?.trim().toLowerCase() || '';
  const status = document.getElementById('projectStatusFilter')?.value || '';

  return projectsCache.filter(p => {
    const matchesSearch = !search ||
      (p.name || '').toLowerCase().includes(search) ||
      (p.description || '').toLowerCase().includes(search);
    const matchesStatus = !status || p.status === status;
    return matchesSearch && matchesStatus;
  });
}

function filterAndRenderProjects() {
  const grid = document.getElementById('projectsGrid');
  if (!grid) return;

  const filtered = filterProjects();
  if (!filtered.length) {
    grid.innerHTML = '<div class="empty">Nenhum projeto encontrado.</div>';
    return;
  }

  grid.innerHTML = filtered.map(p => `
    <div class="project-card">
      <div class="card-title">${escapeHtml(p.name)}</div>
      <div class="card-desc">${escapeHtml(p.description || '') || 'Sem descrição.'}</div>
      <div class="card-meta">${statusLabel(p.status)} · ${formatDate(p.created_at)}</div>
      <div class="card-actions">
        <button type="button" class="btn btn-ghost btn-sm" data-action="view-tasks" data-id="${escapeHtml(p.id)}">Tasks</button>
        <button type="button" class="btn btn-ghost btn-sm" data-action="edit-project" data-id="${escapeHtml(p.id)}">Editar</button>
        <button type="button" class="btn btn-ghost btn-sm" data-action="delete-project" data-id="${escapeHtml(p.id)}">Excluir</button>
      </div>
    </div>
  `).join('');
}

function openNewProjectModal() {
  editingProjectId = null;
  document.getElementById('projectModalTitle').textContent = 'Novo Projeto';
  document.getElementById('projectName').value = '';
  document.getElementById('projectDescription').value = '';
  document.getElementById('projectStatus').value = 'active';
  document.getElementById('projectModal').classList.remove('hidden');
  document.getElementById('projectModal').setAttribute('aria-hidden', 'false');
}

function openEditProjectModal(id) {
  const project = projectsCache.find(p => p.id === id);
  if (!project) return;
  editingProjectId = id;
  document.getElementById('projectModalTitle').textContent = 'Editar Projeto';
  document.getElementById('projectName').value = project.name || '';
  document.getElementById('projectDescription').value = project.description || '';
  document.getElementById('projectStatus').value = project.status || 'active';
  document.getElementById('projectModal').classList.remove('hidden');
  document.getElementById('projectModal').setAttribute('aria-hidden', 'false');
}

function closeProjectModal() {
  const modal = document.getElementById('projectModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
  }
  editingProjectId = null;
}

async function saveProject() {
  const name = document.getElementById('projectName').value.trim();
  const description = document.getElementById('projectDescription').value.trim();
  const status = document.getElementById('projectStatus').value;

  if (!name) {
    toast('Nome do projeto é obrigatório.', 'error');
    return;
  }

  try {
    const body = { name, description, status };
    if (editingProjectId) {
      await apiCall(`/api/projects/${editingProjectId}`, { method: 'PATCH', body });
      toast('Projeto atualizado.', 'success');
    } else {
      await apiCall('/api/projects', { method: 'POST', body });
      toast('Projeto criado.', 'success');
    }
    closeProjectModal();
    await loadProjects();
  } catch (e) {
    toast(e.message, 'error');
  }
}

async function deleteProject(id) {
  const project = projectsCache.find(p => p.id === id);
  if (!project) return;
  if (!confirm(`Excluir o projeto "${project.name}"?`)) return;

  try {
    await apiCall(`/api/projects/${id}`, { method: 'DELETE' });
    toast('Projeto removido.', 'success');
    await loadProjects();
  } catch (e) {
    toast(e.message, 'error');
  }
}

async function loadProjects() {
  try {
    projectsCache = await apiCall('/api/projects') || [];
    filterAndRenderProjects();
  } catch (e) {
    toast(e.message, 'error');
  }
}

export async function initProjects() {
  renderProjectsPage();
  await loadProjects();
}
