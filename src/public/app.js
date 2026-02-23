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

  var taskState = {
    rangeMode: false,
    date: '',
    startDate: '',
    endDate: ''
  };

  function renderTasks() {
    clearApp();

    var today = todayString();
    taskState.date = today;
    taskState.startDate = today;
    taskState.endDate = today;

    // Date filter bar
    var header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap;';
    header.innerHTML = '<h2>Tasks</h2>' +
      '<input type="date" id="task-date" value="' + today + '" />' +
      '<button class="btn-today" id="btn-today">Today</button>' +
      '<label class="range-toggle">' +
        '<input type="checkbox" id="range-toggle" />' +
        'Range' +
      '</label>' +
      '<span id="range-end-container" style="display:none;">' +
        '<span style="font-size:13px;color:#555;">to</span> ' +
        '<input type="date" id="task-date-end" value="' + today + '" />' +
      '</span>';
    app.appendChild(header);

    var dateInput = document.getElementById('task-date');
    var rangeToggle = document.getElementById('range-toggle');
    var rangeEndContainer = document.getElementById('range-end-container');
    var dateEndInput = document.getElementById('task-date-end');

    // Today button
    document.getElementById('btn-today').addEventListener('click', function () {
      var t = todayString();
      dateInput.value = t;
      taskState.date = t;
      if (taskState.rangeMode) {
        taskState.startDate = t;
      }
      syncFormDate();
      reloadTasks();
    });

    // Single date change
    dateInput.addEventListener('change', function () {
      taskState.date = dateInput.value;
      taskState.startDate = dateInput.value;
      syncFormDate();
      reloadTasks();
    });

    // Range toggle
    rangeToggle.addEventListener('change', function () {
      taskState.rangeMode = rangeToggle.checked;
      if (taskState.rangeMode) {
        rangeEndContainer.style.display = '';
        taskState.startDate = dateInput.value;
        taskState.endDate = dateEndInput.value;
      } else {
        rangeEndContainer.style.display = 'none';
      }
      reloadTasks();
    });

    // End date change
    dateEndInput.addEventListener('change', function () {
      taskState.endDate = dateEndInput.value;
      reloadTasks();
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
      var btn = document.getElementById('task-create-btn');
      var desc = document.getElementById('task-desc').value.trim();
      var date = document.getElementById('task-date-input').value;
      var comment = document.getElementById('task-comment').value.trim();
      if (!desc || !date) {
        showError('Description and date are required.');
        return;
      }
      var data = { description: desc, date: date };
      if (comment) data.comment = comment;

      btn.disabled = true;
      api.tasks.create(data).then(function () {
        document.getElementById('task-desc').value = '';
        document.getElementById('task-comment').value = '';
        reloadTasks();
      }).catch(function (err) {
        showError('Failed to create task: ' + err.message);
      }).finally(function () {
        btn.disabled = false;
      });
    });

    // Table container
    var tableContainer = document.createElement('div');
    tableContainer.id = 'tasks-table';
    app.appendChild(tableContainer);

    function syncFormDate() {
      var formDateInput = document.getElementById('task-date-input');
      if (formDateInput) {
        formDateInput.value = taskState.rangeMode ? taskState.startDate : taskState.date;
      }
    }

    function reloadTasks() {
      if (taskState.rangeMode) {
        loadTasks({ startDate: taskState.startDate, endDate: taskState.endDate });
      } else {
        loadTasks({ date: taskState.date });
      }
    }

    reloadTasks();
  }

  function loadTasks(params) {
    var container = document.getElementById('tasks-table');
    if (!container) return;
    container.innerHTML = '<p>Loading...</p>';

    // Remove old error banners
    var banners = app.querySelectorAll('.error-banner');
    banners.forEach(function (b) { b.remove(); });

    var isRange = params.startDate !== undefined;

    api.tasks.list(params).then(function (data) {
      var tasks = data.tasks || [];
      if (tasks.length === 0) {
        var msg = isRange
          ? 'No tasks found for this date range.'
          : 'No tasks found for this date.';
        container.innerHTML = '<div class="empty-state">' + msg + '</div>';
        return;
      }

      // Sort by date ascending
      tasks.sort(function (a, b) {
        if (a.date < b.date) return -1;
        if (a.date > b.date) return 1;
        return 0;
      });

      var html = '<table><thead><tr>' +
        '<th>Date</th><th>Description</th><th>Status</th><th>Comment</th><th>Actions</th>' +
        '</tr></thead><tbody>';
      tasks.forEach(function (t) {
        var isDone = t.status === 'done';
        var rowClass = isDone ? ' class="task-done"' : '';
        var checked = isDone ? ' checked' : '';
        html += '<tr' + rowClass + ' data-task-row="' + t.id + '">' +
          '<td>' + escapeHtml(t.date) + '</td>' +
          '<td class="task-description editable" data-field="description" data-task-id="' + t.id + '">' + escapeHtml(t.description) + '</td>' +
          '<td class="task-status"><input type="checkbox" class="task-status-checkbox" data-task-id="' + t.id + '" data-status="' + (t.status || 'todo') + '"' + checked + ' /></td>' +
          '<td class="task-comment editable" data-field="comment" data-task-id="' + t.id + '">' + escapeHtml(t.comment || '') + '</td>' +
          '<td><button class="btn-danger" data-delete-task="' + t.id + '" data-task-desc="' + escapeHtml(t.description) + '">Delete</button></td>' +
          '</tr>';
      });
      html += '</tbody></table>';
      container.innerHTML = html;

      // Status toggle via checkboxes
      container.querySelectorAll('.task-status-checkbox').forEach(function (cb) {
        cb.addEventListener('change', function () {
          var id = cb.getAttribute('data-task-id');
          var current = cb.getAttribute('data-status');
          var next = current === 'done' ? 'todo' : 'done';
          api.tasks.update(id, { status: next }).then(function () {
            loadTasks(params);
          }).catch(function (err) {
            showError('Failed to update task: ' + err.message);
          });
        });
      });

      // Inline editing for description and comment
      container.querySelectorAll('td.editable').forEach(function (cell) {
        cell.addEventListener('click', function () {
          // Prevent opening a second editor
          if (cell.querySelector('input')) return;

          var field = cell.getAttribute('data-field');
          var taskId = cell.getAttribute('data-task-id');
          var originalValue = cell.textContent;

          var input = document.createElement('input');
          input.type = 'text';
          input.className = 'inline-edit-input';
          input.value = originalValue;

          cell.textContent = '';
          cell.appendChild(input);
          input.focus();
          input.select();

          var saving = false;

          function save() {
            if (saving) return;
            var newValue = input.value.trim();

            // Description cannot be empty
            if (field === 'description' && newValue === '') {
              cancel();
              return;
            }

            // If unchanged, just cancel
            if (newValue === originalValue) {
              cancel();
              return;
            }

            saving = true;
            var updateData = {};
            updateData[field] = newValue;
            api.tasks.update(taskId, updateData).then(function () {
              loadTasks(params);
            }).catch(function (err) {
              showError('Failed to update task: ' + err.message);
              cancel();
            });
          }

          function cancel() {
            cell.textContent = originalValue;
          }

          input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
              e.preventDefault();
              save();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              cancel();
            }
          });

          input.addEventListener('blur', function () {
            if (!saving) {
              save();
            }
          });
        });
      });

      // Delete with confirmation
      container.querySelectorAll('[data-delete-task]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.getAttribute('data-delete-task');
          var desc = btn.getAttribute('data-task-desc');
          if (!confirm('Delete task: "' + desc + '"?')) {
            return;
          }
          api.tasks.delete(id).then(function () {
            loadTasks(params);
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

  var currentProjectId = null;

  function renderProjects() {
    clearApp();

    if (currentProjectId) {
      renderProjectDetail(currentProjectId);
      return;
    }

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
          '<label for="proj-template">Template</label>' +
          '<select id="proj-template"><option value="">No template</option></select>' +
        '</div>' +
        '<div class="form-group">' +
          '<label>&nbsp;</label>' +
          '<button class="btn-primary" id="proj-create-btn">Create</button>' +
        '</div>' +
      '</div>';
    app.appendChild(form);

    // Populate template dropdown
    loadTemplateDropdown();

    document.getElementById('proj-create-btn').addEventListener('click', function () {
      var title = document.getElementById('proj-title').value.trim();
      var anchorDate = document.getElementById('proj-anchor').value;
      var description = document.getElementById('proj-desc').value.trim();
      var templateId = document.getElementById('proj-template').value;
      if (!title || !anchorDate) {
        showError('Title and anchor date are required.');
        return;
      }
      var data = { title: title, anchorDate: anchorDate };
      if (description) data.description = description;
      if (templateId) data.templateId = templateId;
      api.projects.create(data).then(function () {
        document.getElementById('proj-title').value = '';
        document.getElementById('proj-desc').value = '';
        document.getElementById('proj-template').value = '';
        loadProjects();
      }).catch(function (err) {
        showError('Failed to create project: ' + err.message);
      });
    });

    var cardsContainer = document.createElement('div');
    cardsContainer.id = 'projects-table';
    app.appendChild(cardsContainer);

    loadProjects();
  }

  function loadTemplateDropdown() {
    var select = document.getElementById('proj-template');
    if (!select) return;
    api.templates.list().then(function (data) {
      var templates = data.templates || [];
      templates.forEach(function (t) {
        var taskCount = (t.taskDefinitions && t.taskDefinitions.length) || 0;
        var option = document.createElement('option');
        option.value = t.id;
        option.textContent = (t.name || 'Unnamed') + ' (' + taskCount + ' tasks)';
        select.appendChild(option);
      });
    }).catch(function () {
      // Gracefully handle — dropdown just shows "No template"
    });
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
        container.innerHTML = '<div class="empty-state">No projects yet. Create one to get started.</div>';
        return;
      }

      // Fetch tasks for each project to compute progress
      var taskPromises = projects.map(function (p) {
        return api.projects.tasks(p.id).then(function (taskData) {
          return { projectId: p.id, tasks: taskData.tasks || [] };
        }).catch(function () {
          return { projectId: p.id, tasks: [] };
        });
      });

      Promise.all(taskPromises).then(function (taskResults) {
        var taskMap = {};
        taskResults.forEach(function (r) {
          taskMap[r.projectId] = r.tasks;
        });

        container.innerHTML = '';
        var cardsDiv = document.createElement('div');
        cardsDiv.className = 'project-cards';

        projects.forEach(function (p) {
          var tasks = taskMap[p.id] || [];
          var doneCount = tasks.filter(function (t) { return t.status === 'done'; }).length;
          var totalCount = tasks.length;
          var badgeClass = 'progress-badge' + (totalCount > 0 && doneCount === totalCount ? ' all-done' : '');

          var descText = p.description || '';
          var truncatedDesc = descText.length > 100 ? descText.substring(0, 100) + '...' : descText;

          var card = document.createElement('div');
          card.className = 'project-card';
          card.innerHTML =
            '<a class="project-card-title" data-project-id="' + p.id + '">' + escapeHtml(p.title) + '</a>' +
            '<div class="project-card-date">' + escapeHtml(p.anchorDate || '') + '</div>' +
            (truncatedDesc ? '<div class="project-card-desc">' + escapeHtml(truncatedDesc) + '</div>' : '') +
            '<div class="project-card-footer">' +
              '<span class="' + badgeClass + '">' + doneCount + ' / ' + totalCount + ' done</span>' +
              '<button class="btn-danger" data-delete-project="' + p.id + '">Delete</button>' +
            '</div>';
          cardsDiv.appendChild(card);
        });

        container.appendChild(cardsDiv);

        // Click on project title → detail view
        container.querySelectorAll('[data-project-id]').forEach(function (el) {
          el.addEventListener('click', function (e) {
            e.preventDefault();
            currentProjectId = el.getAttribute('data-project-id');
            renderProjects();
          });
        });

        // Delete project
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
      });
    }).catch(function (err) {
      container.innerHTML = '';
      showError('Failed to load projects: ' + err.message);
    });
  }

  function renderProjectDetail(projectId) {
    var backBtn = document.createElement('button');
    backBtn.className = 'btn-back';
    backBtn.textContent = '\u2190 Back to Projects';
    backBtn.addEventListener('click', function () {
      currentProjectId = null;
      renderProjects();
    });
    app.appendChild(backBtn);

    var detailContainer = document.createElement('div');
    detailContainer.id = 'project-detail';
    detailContainer.innerHTML = '<p>Loading...</p>';
    app.appendChild(detailContainer);

    loadProjectDetail(projectId);
  }

  function loadProjectDetail(projectId) {
    var container = document.getElementById('project-detail');
    if (!container) return;

    var banners = app.querySelectorAll('.error-banner');
    banners.forEach(function (b) { b.remove(); });

    api.projects.get(projectId).then(function (project) {
      container.innerHTML = '';

      // Header with title and delete button
      var headerDiv = document.createElement('div');
      headerDiv.className = 'project-detail-header';

      var titleEl = document.createElement('h2');
      titleEl.textContent = project.title || '';
      headerDiv.appendChild(titleEl);

      var deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn-danger';
      deleteBtn.textContent = 'Delete';
      var deleteTimeout = null;
      deleteBtn.addEventListener('click', function () {
        if (deleteBtn.textContent === 'Confirm Delete?') {
          clearTimeout(deleteTimeout);
          api.projects.delete(projectId).then(function () {
            currentProjectId = null;
            renderProjects();
          }).catch(function (err) {
            showError('Failed to delete project: ' + err.message);
          });
        } else {
          deleteBtn.textContent = 'Confirm Delete?';
          deleteTimeout = setTimeout(function () {
            deleteBtn.textContent = 'Delete';
          }, 3000);
        }
      });
      headerDiv.appendChild(deleteBtn);
      container.appendChild(headerDiv);

      // Meta info
      var meta = document.createElement('div');
      meta.className = 'project-detail-meta';
      meta.textContent = 'Anchor date: ' + (project.anchorDate || '');
      container.appendChild(meta);

      // Description
      if (project.description) {
        var descDiv = document.createElement('div');
        descDiv.className = 'project-detail-desc';
        descDiv.textContent = project.description;
        container.appendChild(descDiv);
      }

      // Tasks section
      var tasksHeader = document.createElement('h3');
      tasksHeader.textContent = 'Tasks';
      tasksHeader.style.marginBottom = '12px';
      container.appendChild(tasksHeader);

      var tasksContainer = document.createElement('div');
      tasksContainer.id = 'project-tasks-table';
      tasksContainer.innerHTML = '<p>Loading tasks...</p>';
      container.appendChild(tasksContainer);

      loadProjectTasks(projectId);
    }).catch(function (err) {
      container.innerHTML = '';
      showError('Failed to load project: ' + err.message);
    });
  }

  function loadProjectTasks(projectId) {
    var container = document.getElementById('project-tasks-table');
    if (!container) return;

    api.projects.tasks(projectId).then(function (data) {
      var tasks = data.tasks || [];
      if (tasks.length === 0) {
        container.innerHTML = '<div class="empty-state">No tasks for this project.</div>';
        return;
      }
      var html = '<table><thead><tr>' +
        '<th>Description</th><th>Date</th><th>Status</th><th>Comment</th>' +
        '</tr></thead><tbody>';
      tasks.forEach(function (t) {
        var statusClass = t.status === 'done' ? 'status-done' : 'status-todo';
        html += '<tr>' +
          '<td>' + escapeHtml(t.description) + '</td>' +
          '<td>' + escapeHtml(t.date || '') + '</td>' +
          '<td class="' + statusClass + '" data-task-id="' + t.id + '" data-status="' + t.status + '">' +
            escapeHtml(t.status || 'todo') + '</td>' +
          '<td>' + escapeHtml(t.comment || '') + '</td>' +
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
            loadProjectTasks(projectId);
          }).catch(function (err) {
            showError('Failed to update task: ' + err.message);
          });
        });
      });
    }).catch(function (err) {
      container.innerHTML = '';
      showError('Failed to load project tasks: ' + err.message);
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
