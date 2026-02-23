(function () {
  'use strict';

  var app = document.getElementById('app');

  // ── Helpers ─────────────────────────────────────────────────────

  function todayString() {
    var d = new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  function showError(msg) {
    var banner = document.createElement('div');
    banner.className = 'error-banner';
    banner.textContent = msg;
    app.prepend(banner);
  }

  function clearApp() {
    app.innerHTML = '';
  }

  // ── Router ──────────────────────────────────────────────────────

  var routes = {
    '#/tasks': renderTasks,
    '#/projects': renderProjects,
    '#/templates': renderTemplates,
  };

  function navigate() {
    var hash = location.hash || '';
    var handler = routes[hash];
    if (!handler) {
      location.hash = '#/tasks';
      return;
    }
    // Update active nav link
    var links = document.querySelectorAll('nav a:not(.brand)');
    links.forEach(function (a) {
      a.classList.toggle('active', a.getAttribute('href') === hash);
    });
    handler();
  }

  window.addEventListener('hashchange', navigate);
  window.addEventListener('DOMContentLoaded', navigate);

  // ── Tasks View ──────────────────────────────────────────────────

  function renderTasks() {
    clearApp();

    var today = todayString();

    // Date picker row
    var header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;gap:12px;margin-bottom:16px;';
    header.innerHTML = '<h2>Tasks</h2>' +
      '<input type="date" id="task-date" value="' + today + '" />';
    app.appendChild(header);

    var dateInput = document.getElementById('task-date');
    dateInput.addEventListener('change', function () {
      loadTasks(dateInput.value);
    });

    // Create form
    var form = document.createElement('div');
    form.className = 'form-section';
    form.innerHTML =
      '<h3>New Task</h3>' +
      '<div class="form-row">' +
        '<div class="form-group">' +
          '<label for="task-desc">Description</label>' +
          '<input type="text" id="task-desc" placeholder="What needs to be done?" style="width:300px;" />' +
        '</div>' +
        '<div class="form-group">' +
          '<label for="task-date-input">Date</label>' +
          '<input type="date" id="task-date-input" value="' + today + '" />' +
        '</div>' +
        '<div class="form-group">' +
          '<label for="task-comment">Comment</label>' +
          '<input type="text" id="task-comment" placeholder="Optional" style="width:200px;" />' +
        '</div>' +
        '<div class="form-group">' +
          '<label>&nbsp;</label>' +
          '<button class="btn-primary" id="task-create-btn">Create</button>' +
        '</div>' +
      '</div>';
    app.appendChild(form);

    document.getElementById('task-create-btn').addEventListener('click', function () {
      var desc = document.getElementById('task-desc').value.trim();
      var date = document.getElementById('task-date-input').value;
      var comment = document.getElementById('task-comment').value.trim();
      if (!desc || !date) {
        showError('Description and date are required.');
        return;
      }
      var data = { description: desc, date: date };
      if (comment) data.comment = comment;
      api.tasks.create(data).then(function () {
        document.getElementById('task-desc').value = '';
        document.getElementById('task-comment').value = '';
        loadTasks(dateInput.value);
      }).catch(function (err) {
        showError('Failed to create task: ' + err.message);
      });
    });

    // Table container
    var tableContainer = document.createElement('div');
    tableContainer.id = 'tasks-table';
    app.appendChild(tableContainer);

    loadTasks(today);
  }

  function loadTasks(date) {
    var container = document.getElementById('tasks-table');
    if (!container) return;
    container.innerHTML = '<p>Loading...</p>';

    // Remove old error banners
    var banners = app.querySelectorAll('.error-banner');
    banners.forEach(function (b) { b.remove(); });

    api.tasks.list({ date: date }).then(function (data) {
      var tasks = data.tasks || [];
      if (tasks.length === 0) {
        container.innerHTML = '<div class="empty-state">No tasks for this date.</div>';
        return;
      }
      var html = '<table><thead><tr>' +
        '<th>Description</th><th>Date</th><th>Status</th><th>Comment</th><th>Actions</th>' +
        '</tr></thead><tbody>';
      tasks.forEach(function (t) {
        var statusClass = t.status === 'done' ? 'status-done' : 'status-todo';
        html += '<tr>' +
          '<td>' + escapeHtml(t.description) + '</td>' +
          '<td>' + escapeHtml(t.date) + '</td>' +
          '<td class="' + statusClass + '" data-task-id="' + t.id + '" data-status="' + t.status + '">' +
            escapeHtml(t.status || 'todo') + '</td>' +
          '<td>' + escapeHtml(t.comment || '') + '</td>' +
          '<td><button class="btn-danger" data-delete-task="' + t.id + '">Delete</button></td>' +
          '</tr>';
      });
      html += '</tbody></table>';
      container.innerHTML = html;

      // Status toggle
      container.querySelectorAll('[data-task-id]').forEach(function (el) {
        el.addEventListener('click', function () {
          var id = el.getAttribute('data-task-id');
          var current = el.getAttribute('data-status');
          var next = current === 'done' ? 'todo' : 'done';
          api.tasks.update(id, { status: next }).then(function () {
            loadTasks(date);
          }).catch(function (err) {
            showError('Failed to update task: ' + err.message);
          });
        });
      });

      // Delete
      container.querySelectorAll('[data-delete-task]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.getAttribute('data-delete-task');
          api.tasks.delete(id).then(function () {
            loadTasks(date);
          }).catch(function (err) {
            showError('Failed to delete task: ' + err.message);
          });
        });
      });
    }).catch(function (err) {
      container.innerHTML = '';
      showError('Failed to load tasks: ' + err.message);
    });
  }

  // ── Projects View ───────────────────────────────────────────────

  function renderProjects() {
    clearApp();

    var header = document.createElement('h2');
    header.textContent = 'Projects';
    app.appendChild(header);

    // Create form
    var form = document.createElement('div');
    form.className = 'form-section';
    form.innerHTML =
      '<h3>New Project</h3>' +
      '<div class="form-row">' +
        '<div class="form-group">' +
          '<label for="proj-title">Title</label>' +
          '<input type="text" id="proj-title" placeholder="Project title" style="width:250px;" />' +
        '</div>' +
        '<div class="form-group">' +
          '<label for="proj-anchor">Anchor Date</label>' +
          '<input type="date" id="proj-anchor" value="' + todayString() + '" />' +
        '</div>' +
        '<div class="form-group">' +
          '<label for="proj-desc">Description</label>' +
          '<input type="text" id="proj-desc" placeholder="Optional" style="width:250px;" />' +
        '</div>' +
        '<div class="form-group">' +
          '<label>&nbsp;</label>' +
          '<button class="btn-primary" id="proj-create-btn">Create</button>' +
        '</div>' +
      '</div>';
    app.appendChild(form);

    document.getElementById('proj-create-btn').addEventListener('click', function () {
      var title = document.getElementById('proj-title').value.trim();
      var anchorDate = document.getElementById('proj-anchor').value;
      var description = document.getElementById('proj-desc').value.trim();
      if (!title || !anchorDate) {
        showError('Title and anchor date are required.');
        return;
      }
      var data = { title: title, anchorDate: anchorDate };
      if (description) data.description = description;
      api.projects.create(data).then(function () {
        document.getElementById('proj-title').value = '';
        document.getElementById('proj-desc').value = '';
        loadProjects();
      }).catch(function (err) {
        showError('Failed to create project: ' + err.message);
      });
    });

    var tableContainer = document.createElement('div');
    tableContainer.id = 'projects-table';
    app.appendChild(tableContainer);

    loadProjects();
  }

  function loadProjects() {
    var container = document.getElementById('projects-table');
    if (!container) return;
    container.innerHTML = '<p>Loading...</p>';

    var banners = app.querySelectorAll('.error-banner');
    banners.forEach(function (b) { b.remove(); });

    api.projects.list().then(function (data) {
      var projects = data.projects || [];
      if (projects.length === 0) {
        container.innerHTML = '<div class="empty-state">No projects yet.</div>';
        return;
      }
      var html = '<table><thead><tr>' +
        '<th>Title</th><th>Anchor Date</th><th>Description</th><th>Actions</th>' +
        '</tr></thead><tbody>';
      projects.forEach(function (p) {
        html += '<tr>' +
          '<td>' + escapeHtml(p.title) + '</td>' +
          '<td>' + escapeHtml(p.anchorDate || '') + '</td>' +
          '<td>' + escapeHtml(p.description || '') + '</td>' +
          '<td><button class="btn-danger" data-delete-project="' + p.id + '">Delete</button></td>' +
          '</tr>';
      });
      html += '</tbody></table>';
      container.innerHTML = html;

      // Delete
      container.querySelectorAll('[data-delete-project]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.getAttribute('data-delete-project');
          api.projects.delete(id).then(function () {
            loadProjects();
          }).catch(function (err) {
            showError('Failed to delete project: ' + err.message);
          });
        });
      });
    }).catch(function (err) {
      container.innerHTML = '';
      showError('Failed to load projects: ' + err.message);
    });
  }

  // ── Templates View ──────────────────────────────────────────────

  function renderTemplates() {
    clearApp();

    var header = document.createElement('h2');
    header.textContent = 'Templates';
    app.appendChild(header);

    var tableContainer = document.createElement('div');
    tableContainer.id = 'templates-table';
    app.appendChild(tableContainer);

    loadTemplates();
  }

  function loadTemplates() {
    var container = document.getElementById('templates-table');
    if (!container) return;
    container.innerHTML = '<p>Loading...</p>';

    var banners = app.querySelectorAll('.error-banner');
    banners.forEach(function (b) { b.remove(); });

    api.templates.list().then(function (data) {
      var templates = data.templates || [];
      if (templates.length === 0) {
        container.innerHTML = '<div class="empty-state">No templates yet.</div>';
        return;
      }
      var html = '<table><thead><tr>' +
        '<th>Name</th><th>Description</th><th>Task Count</th>' +
        '</tr></thead><tbody>';
      templates.forEach(function (t) {
        var taskCount = (t.taskDefinitions && t.taskDefinitions.length) || 0;
        html += '<tr>' +
          '<td>' + escapeHtml(t.name || '') + '</td>' +
          '<td>' + escapeHtml(t.description || '') + '</td>' +
          '<td>' + taskCount + '</td>' +
          '</tr>';
      });
      html += '</tbody></table>';
      container.innerHTML = html;
    }).catch(function (err) {
      container.innerHTML = '';
      showError('Failed to load templates: ' + err.message);
    });
  }

  // ── Utility ─────────────────────────────────────────────────────

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;');
  }
})();
