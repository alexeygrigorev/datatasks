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
    '#/bundles': renderBundles,
    '#/templates': renderTemplates,
    '#/recurring': renderRecurring,
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
    endDate: '',
    statusFilter: 'all',
    assigneeFilter: '',
    bundleFilter: ''
  };

  // Cached users map: { id: { id, name, email } }
  var usersCache = null;
  // Cached bundles list for filter dropdown
  var bundlesCache = null;

  function loadUsersOnce() {
    if (usersCache) {
      return Promise.resolve(usersCache);
    }
    return api.users.list().then(function (data) {
      var map = {};
      (data.users || []).forEach(function (u) {
        map[u.id] = u;
      });
      usersCache = map;
      return map;
    }).catch(function () {
      usersCache = {};
      return {};
    });
  }

  function loadBundlesOnce() {
    if (bundlesCache) {
      return Promise.resolve(bundlesCache);
    }
    return api.bundles.list().then(function (data) {
      bundlesCache = data.bundles || [];
      return bundlesCache;
    }).catch(function () {
      bundlesCache = [];
      return [];
    });
  }

  function renderTasks() {
    clearApp();

    var today = todayString();
    taskState.date = today;
    taskState.startDate = today;
    taskState.endDate = today;
    taskState.statusFilter = 'all';
    taskState.assigneeFilter = '';
    taskState.bundleFilter = '';

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

    // Filter bar
    var filterBar = document.createElement('div');
    filterBar.className = 'filter-bar';
    filterBar.innerHTML =
      '<label for="filter-status">Status</label>' +
      '<select id="filter-status">' +
        '<option value="all">All</option>' +
        '<option value="todo">Todo</option>' +
        '<option value="done">Done</option>' +
      '</select>' +
      '<label for="filter-assignee">Assignee</label>' +
      '<select id="filter-assignee"><option value="">All</option></select>' +
      '<label for="filter-bundle">Bundle</label>' +
      '<select id="filter-bundle"><option value="">All (by date)</option></select>';
    app.appendChild(filterBar);

    var dateInput = document.getElementById('task-date');
    var rangeToggle = document.getElementById('range-toggle');
    var rangeEndContainer = document.getElementById('range-end-container');
    var dateEndInput = document.getElementById('task-date-end');
    var statusFilter = document.getElementById('filter-status');
    var assigneeFilter = document.getElementById('filter-assignee');
    var bundleFilterEl = document.getElementById('filter-bundle');

    // Populate assignee dropdown
    loadUsersOnce().then(function (users) {
      Object.keys(users).forEach(function (uid) {
        var opt = document.createElement('option');
        opt.value = uid;
        opt.textContent = users[uid].name;
        assigneeFilter.appendChild(opt);
      });
      // Also populate the create form assignee dropdown
      populateCreateFormAssignee(users);
    });

    // Populate bundle dropdown
    loadBundlesOnce().then(function (bundles) {
      bundles.forEach(function (b) {
        var opt = document.createElement('option');
        opt.value = b.id;
        opt.textContent = b.title || 'Untitled';
        bundleFilterEl.appendChild(opt);
      });
    });

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

    // Status filter
    statusFilter.addEventListener('change', function () {
      taskState.statusFilter = statusFilter.value;
      reloadTasks();
    });

    // Assignee filter
    assigneeFilter.addEventListener('change', function () {
      taskState.assigneeFilter = assigneeFilter.value;
      reloadTasks();
    });

    // Bundle filter
    bundleFilterEl.addEventListener('change', function () {
      taskState.bundleFilter = bundleFilterEl.value;
      reloadTasks();
    });

    // Create form (no comment field, with assignee dropdown)
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
          '<label for="task-assignee">Assignee</label>' +
          '<select id="task-assignee"><option value="">None</option></select>' +
        '</div>' +
        '<div class="form-group">' +
          '<label>&nbsp;</label>' +
          '<button class="btn-primary" id="task-create-btn">Create</button>' +
        '</div>' +
      '</div>';
    app.appendChild(form);

    function populateCreateFormAssignee(users) {
      var sel = document.getElementById('task-assignee');
      if (!sel) return;
      Object.keys(users).forEach(function (uid) {
        var opt = document.createElement('option');
        opt.value = uid;
        opt.textContent = users[uid].name;
        sel.appendChild(opt);
      });
    }

    document.getElementById('task-create-btn').addEventListener('click', function () {
      var btn = document.getElementById('task-create-btn');
      var desc = document.getElementById('task-desc').value.trim();
      var date = document.getElementById('task-date-input').value;
      var assigneeId = document.getElementById('task-assignee').value;
      if (!desc || !date) {
        showError('Description and date are required.');
        return;
      }
      var data = { description: desc, date: date, source: 'manual' };
      if (assigneeId) data.assigneeId = assigneeId;

      btn.disabled = true;
      api.tasks.create(data).then(function () {
        document.getElementById('task-desc').value = '';
        document.getElementById('task-assignee').value = '';
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
      var params;
      // If bundle filter is set, use bundleId query (ignore date)
      if (taskState.bundleFilter) {
        params = { bundleId: taskState.bundleFilter };
      } else if (taskState.rangeMode) {
        params = { startDate: taskState.startDate, endDate: taskState.endDate };
      } else {
        params = { date: taskState.date };
      }
      loadTasks(params);
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

    var isBundleQuery = !!params.bundleId;
    var isRange = params.startDate !== undefined;

    // Load tasks and users in parallel
    Promise.all([
      api.tasks.list(params),
      loadUsersOnce()
    ]).then(function (results) {
      var data = results[0];
      var usersMap = results[1];
      var tasks = data.tasks || [];

      // Apply client-side status filter
      if (taskState.statusFilter && taskState.statusFilter !== 'all') {
        tasks = tasks.filter(function (t) {
          return t.status === taskState.statusFilter;
        });
      }

      // Apply client-side assignee filter
      if (taskState.assigneeFilter) {
        tasks = tasks.filter(function (t) {
          return t.assigneeId === taskState.assigneeFilter;
        });
      }

      if (tasks.length === 0) {
        var msg = isBundleQuery
          ? 'No tasks found for this bundle.'
          : isRange
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

      // Collect unique bundleIds and fetch bundle titles
      var bundleIds = [];
      tasks.forEach(function (t) {
        if (t.bundleId && bundleIds.indexOf(t.bundleId) === -1) {
          bundleIds.push(t.bundleId);
        }
      });

      var bundlePromises = bundleIds.map(function (bid) {
        return api.bundles.get(bid).then(function (data) {
          return { id: bid, title: data.bundle.title || 'Untitled' };
        }).catch(function () {
          return { id: bid, title: 'Unknown' };
        });
      });

      Promise.all(bundlePromises).then(function (bundleResults) {
        var bundleMap = {};
        bundleResults.forEach(function (b) {
          bundleMap[b.id] = b.title;
        });

        renderTaskTable(tasks, bundleMap, usersMap, container, params);
      });
    }).catch(function (err) {
      container.innerHTML = '';
      showError('Failed to load tasks: ' + err.message);
    });
  }

  function renderTaskTable(tasks, bundleMap, usersMap, container, params) {
      var html = '<table class="task-table-compact"><thead><tr>' +
        '<th></th><th>Date</th><th>Description</th><th>Bundle</th><th>Info</th><th>Assignee</th><th>Required Link</th>' +
        '</tr></thead><tbody>';
      tasks.forEach(function (t) {
        var isDone = t.status === 'done';
        var rowClass = isDone ? ' class="task-done"' : '';
        var checked = isDone ? ' checked' : '';

        // Checkbox disabled if requiredLinkName is set and link is empty
        var checkboxDisabled = '';
        if (t.requiredLinkName && !t.link) {
          checkboxDisabled = ' disabled';
        }

        // Bundle badge
        var bundleBadge;
        if (t.bundleId && bundleMap[t.bundleId]) {
          bundleBadge = '<a class="badge-bundle" data-nav-bundle="' + escapeHtml(t.bundleId) + '">' + escapeHtml(bundleMap[t.bundleId]) + '</a>';
        } else {
          bundleBadge = '<span class="badge-adhoc">ad hoc</span>';
        }

        // Instructions link icon
        var instructionsHtml = '';
        if (t.instructionsUrl) {
          instructionsHtml = '<a class="instructions-link" href="' + escapeHtml(t.instructionsUrl) + '" target="_blank" rel="noopener" title="Instructions">\u{1F4CB}</a>';
        }

        // Assignee name
        var assigneeHtml = '';
        if (t.assigneeId && usersMap[t.assigneeId]) {
          assigneeHtml = '<span class="badge-assignee">' + escapeHtml(usersMap[t.assigneeId].name) + '</span>';
        }

        // Required link input
        var requiredLinkHtml = '';
        if (t.requiredLinkName) {
          requiredLinkHtml = '<span class="required-link-wrapper">' +
            '<span class="required-link-label">' + escapeHtml(t.requiredLinkName) + ':</span>' +
            '<input type="text" class="required-link-input" data-task-id="' + t.id + '" value="' + escapeHtml(t.link || '') + '" placeholder="URL" />' +
            '</span>';
        }

        html += '<tr' + rowClass + ' data-task-row="' + t.id + '">' +
          '<td class="task-status"><input type="checkbox" class="task-status-checkbox" data-task-id="' + t.id + '" data-status="' + (t.status || 'todo') + '"' + checked + checkboxDisabled + ' /></td>' +
          '<td>' + escapeHtml(t.date) + '</td>' +
          '<td class="task-description editable" data-field="description" data-task-id="' + t.id + '">' + renderMarkdownLinks(t.description) + '</td>' +
          '<td>' + bundleBadge + '</td>' +
          '<td>' + instructionsHtml + '</td>' +
          '<td>' + assigneeHtml + '</td>' +
          '<td>' + requiredLinkHtml + '</td>' +
          '</tr>';
      });
      html += '</tbody></table>';
      container.innerHTML = html;

      // Bundle navigation links
      container.querySelectorAll('[data-nav-bundle]').forEach(function (el) {
        el.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          currentBundleId = el.getAttribute('data-nav-bundle');
          location.hash = '#/bundles';
        });
      });

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

      // Required link input: save on Enter or blur
      container.querySelectorAll('.required-link-input').forEach(function (inp) {
        var saving = false;
        function saveLink() {
          if (saving) return;
          saving = true;
          var taskId = inp.getAttribute('data-task-id');
          var linkValue = inp.value.trim();
          api.tasks.update(taskId, { link: linkValue }).then(function () {
            loadTasks(params);
          }).catch(function (err) {
            showError('Failed to save link: ' + err.message);
            saving = false;
          });
        }
        inp.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') {
            e.preventDefault();
            saveLink();
          }
        });
        inp.addEventListener('blur', function () {
          saveLink();
        });
        // Prevent click from triggering row editable behavior
        inp.addEventListener('click', function (e) {
          e.stopPropagation();
        });
      });

      // Inline editing for description
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
  }

  // ── Bundles View ───────────────────────────────────────────────

  var currentBundleId = null;

  function renderBundles() {
    clearApp();

    if (currentBundleId) {
      renderBundleDetail(currentBundleId);
      return;
    }

    var header = document.createElement('h2');
    header.textContent = 'Bundles';
    app.appendChild(header);

    // Create form
    var form = document.createElement('div');
    form.className = 'form-section';
    form.innerHTML =
      '<h3>New Bundle</h3>' +
      '<div class="form-row">' +
        '<div class="form-group">' +
          '<label for="bundle-title">Title</label>' +
          '<input type="text" id="bundle-title" placeholder="Bundle title" style="width:250px;" />' +
        '</div>' +
        '<div class="form-group">' +
          '<label for="bundle-anchor">Anchor Date</label>' +
          '<input type="date" id="bundle-anchor" value="' + todayString() + '" />' +
        '</div>' +
        '<div class="form-group">' +
          '<label for="bundle-desc">Description</label>' +
          '<input type="text" id="bundle-desc" placeholder="Optional" style="width:250px;" />' +
        '</div>' +
        '<div class="form-group">' +
          '<label for="bundle-template">Template</label>' +
          '<select id="bundle-template"><option value="">No template</option></select>' +
        '</div>' +
        '<div class="form-group">' +
          '<label>&nbsp;</label>' +
          '<button class="btn-primary" id="bundle-create-btn">Create</button>' +
        '</div>' +
      '</div>';
    app.appendChild(form);

    // Populate template dropdown
    loadTemplateDropdown();

    document.getElementById('bundle-create-btn').addEventListener('click', function () {
      var title = document.getElementById('bundle-title').value.trim();
      var anchorDate = document.getElementById('bundle-anchor').value;
      var description = document.getElementById('bundle-desc').value.trim();
      var templateId = document.getElementById('bundle-template').value;
      if (!title || !anchorDate) {
        showError('Title and anchor date are required.');
        return;
      }
      var data = { title: title, anchorDate: anchorDate };
      if (description) data.description = description;
      if (templateId) data.templateId = templateId;
      api.bundles.create(data).then(function () {
        document.getElementById('bundle-title').value = '';
        document.getElementById('bundle-desc').value = '';
        document.getElementById('bundle-template').value = '';
        loadBundles();
      }).catch(function (err) {
        showError('Failed to create bundle: ' + err.message);
      });
    });

    var cardsContainer = document.createElement('div');
    cardsContainer.id = 'bundles-table';
    app.appendChild(cardsContainer);

    loadBundles();
  }

  function loadTemplateDropdown() {
    var select = document.getElementById('bundle-template');
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

  function loadBundles() {
    var container = document.getElementById('bundles-table');
    if (!container) return;
    container.innerHTML = '<p>Loading...</p>';

    var banners = app.querySelectorAll('.error-banner');
    banners.forEach(function (b) { b.remove(); });

    api.bundles.list().then(function (data) {
      var bundles = data.bundles || [];
      if (bundles.length === 0) {
        container.innerHTML = '<div class="empty-state">No bundles yet. Create one to get started.</div>';
        return;
      }

      // Fetch tasks for each bundle to compute progress
      var taskPromises = bundles.map(function (b) {
        return api.bundles.tasks(b.id).then(function (taskData) {
          return { bundleId: b.id, tasks: taskData.tasks || [] };
        }).catch(function () {
          return { bundleId: b.id, tasks: [] };
        });
      });

      Promise.all(taskPromises).then(function (taskResults) {
        var taskMap = {};
        taskResults.forEach(function (r) {
          taskMap[r.bundleId] = r.tasks;
        });

        container.innerHTML = '';
        var cardsDiv = document.createElement('div');
        cardsDiv.className = 'bundle-cards';

        bundles.forEach(function (b) {
          var tasks = taskMap[b.id] || [];
          var doneCount = tasks.filter(function (t) { return t.status === 'done'; }).length;
          var totalCount = tasks.length;
          var badgeClass = 'progress-badge' + (totalCount > 0 && doneCount === totalCount ? ' all-done' : '');

          var descText = b.description || '';
          var truncatedDesc = descText.length > 100 ? descText.substring(0, 100) + '...' : descText;

          var card = document.createElement('div');
          card.className = 'bundle-card';
          card.innerHTML =
            '<a class="bundle-card-title" data-bundle-id="' + b.id + '">' + escapeHtml(b.title) + '</a>' +
            '<div class="bundle-card-date">' + escapeHtml(b.anchorDate || '') + '</div>' +
            (truncatedDesc ? '<div class="bundle-card-desc">' + escapeHtml(truncatedDesc) + '</div>' : '') +
            '<div class="bundle-card-footer">' +
              '<span class="' + badgeClass + '">' + doneCount + ' / ' + totalCount + ' done</span>' +
              '<button class="btn-danger" data-delete-bundle="' + b.id + '">Delete</button>' +
            '</div>';
          cardsDiv.appendChild(card);
        });

        container.appendChild(cardsDiv);

        // Click on bundle title -> detail view
        container.querySelectorAll('[data-bundle-id]').forEach(function (el) {
          el.addEventListener('click', function (e) {
            e.preventDefault();
            currentBundleId = el.getAttribute('data-bundle-id');
            renderBundles();
          });
        });

        // Delete bundle
        container.querySelectorAll('[data-delete-bundle]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var id = btn.getAttribute('data-delete-bundle');
            api.bundles.delete(id).then(function () {
              loadBundles();
            }).catch(function (err) {
              showError('Failed to delete bundle: ' + err.message);
            });
          });
        });
      });
    }).catch(function (err) {
      container.innerHTML = '';
      showError('Failed to load bundles: ' + err.message);
    });
  }

  function renderBundleDetail(bundleId) {
    var backBtn = document.createElement('button');
    backBtn.className = 'btn-back';
    backBtn.textContent = '\u2190 Back to Bundles';
    backBtn.addEventListener('click', function () {
      currentBundleId = null;
      renderBundles();
    });
    app.appendChild(backBtn);

    var detailContainer = document.createElement('div');
    detailContainer.id = 'bundle-detail';
    detailContainer.innerHTML = '<p>Loading...</p>';
    app.appendChild(detailContainer);

    loadBundleDetail(bundleId);
  }

  function loadBundleDetail(bundleId) {
    var container = document.getElementById('bundle-detail');
    if (!container) return;

    var banners = app.querySelectorAll('.error-banner');
    banners.forEach(function (b) { b.remove(); });

    api.bundles.get(bundleId).then(function (data) {
      var bundle = data.bundle;
      container.innerHTML = '';

      // Header with title and delete button
      var headerDiv = document.createElement('div');
      headerDiv.className = 'bundle-detail-header';

      var titleEl = document.createElement('h2');
      titleEl.textContent = bundle.title || '';
      headerDiv.appendChild(titleEl);

      var deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn-danger';
      deleteBtn.textContent = 'Delete';
      var deleteTimeout = null;
      deleteBtn.addEventListener('click', function () {
        if (deleteBtn.textContent === 'Confirm Delete?') {
          clearTimeout(deleteTimeout);
          api.bundles.delete(bundleId).then(function () {
            currentBundleId = null;
            renderBundles();
          }).catch(function (err) {
            showError('Failed to delete bundle: ' + err.message);
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
      meta.className = 'bundle-detail-meta';
      meta.textContent = 'Anchor date: ' + (bundle.anchorDate || '');
      container.appendChild(meta);

      // Description
      if (bundle.description) {
        var descDiv = document.createElement('div');
        descDiv.className = 'bundle-detail-desc';
        descDiv.innerHTML = renderMarkdownLinks(bundle.description);
        container.appendChild(descDiv);
      }

      // Links section
      var linksSection = document.createElement('div');
      linksSection.className = 'bundle-links-section';
      var linksHeader = document.createElement('h3');
      linksHeader.textContent = 'Links';
      linksHeader.style.marginBottom = '8px';
      linksSection.appendChild(linksHeader);

      var linksList = document.createElement('div');
      linksList.className = 'bundle-links-list';
      var bundleLinks = bundle.links || [];
      if (bundleLinks.length === 0) {
        linksList.innerHTML = '<div class="empty-state" style="padding:8px 0;">No links yet.</div>';
      } else {
        bundleLinks.forEach(function (link, idx) {
          var linkRow = document.createElement('div');
          linkRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:4px;';
          linkRow.innerHTML =
            '<a href="' + escapeHtml(link.url) + '" target="_blank" rel="noopener">' + escapeHtml(link.name || link.url) + '</a>' +
            '<button class="btn-danger" style="padding:2px 8px;font-size:12px;" data-remove-link="' + idx + '">x</button>';
          linksList.appendChild(linkRow);
        });
      }
      linksSection.appendChild(linksList);

      // Add link form
      var addLinkForm = document.createElement('div');
      addLinkForm.style.cssText = 'display:flex;align-items:center;gap:8px;margin-top:8px;';
      addLinkForm.innerHTML =
        '<input type="text" id="link-name" placeholder="Link name" style="width:150px;" />' +
        '<input type="url" id="link-url" placeholder="https://..." style="width:250px;" />' +
        '<button class="btn-primary" id="add-link-btn" style="padding:6px 12px;">Add</button>';
      linksSection.appendChild(addLinkForm);
      container.appendChild(linksSection);

      // Add link handler
      document.getElementById('add-link-btn').addEventListener('click', function () {
        var name = document.getElementById('link-name').value.trim();
        var url = document.getElementById('link-url').value.trim();
        if (!url) {
          showError('URL is required.');
          return;
        }
        var updatedLinks = (bundle.links || []).concat([{ name: name || url, url: url }]);
        api.bundles.update(bundleId, { links: updatedLinks }).then(function () {
          loadBundleDetail(bundleId);
        }).catch(function (err) {
          showError('Failed to add link: ' + err.message);
        });
      });

      // Remove link handlers
      linksSection.querySelectorAll('[data-remove-link]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var idx = parseInt(btn.getAttribute('data-remove-link'), 10);
          var updatedLinks = (bundle.links || []).filter(function (_, i) { return i !== idx; });
          api.bundles.update(bundleId, { links: updatedLinks }).then(function () {
            loadBundleDetail(bundleId);
          }).catch(function (err) {
            showError('Failed to remove link: ' + err.message);
          });
        });
      });

      // Tasks section
      var tasksHeader = document.createElement('h3');
      tasksHeader.textContent = 'Tasks';
      tasksHeader.style.marginBottom = '12px';
      container.appendChild(tasksHeader);

      var tasksContainer = document.createElement('div');
      tasksContainer.id = 'bundle-tasks-table';
      tasksContainer.innerHTML = '<p>Loading tasks...</p>';
      container.appendChild(tasksContainer);

      loadBundleTasks(bundleId);
    }).catch(function (err) {
      container.innerHTML = '';
      showError('Failed to load bundle: ' + err.message);
    });
  }

  function loadBundleTasks(bundleId) {
    var container = document.getElementById('bundle-tasks-table');
    if (!container) return;

    api.bundles.tasks(bundleId).then(function (data) {
      var tasks = data.tasks || [];
      if (tasks.length === 0) {
        container.innerHTML = '<div class="empty-state">No tasks for this bundle.</div>';
        return;
      }
      var html = '<table><thead><tr>' +
        '<th>Description</th><th>Date</th><th>Status</th><th>Comment</th>' +
        '</tr></thead><tbody>';
      tasks.forEach(function (t) {
        var statusClass = t.status === 'done' ? 'status-done' : 'status-todo';
        html += '<tr>' +
          '<td>' + renderMarkdownLinks(t.description) + '</td>' +
          '<td>' + escapeHtml(t.date || '') + '</td>' +
          '<td class="' + statusClass + '" data-task-id="' + t.id + '" data-status="' + t.status + '">' +
            escapeHtml(t.status || 'todo') + '</td>' +
          '<td>' + renderMarkdownLinks(t.comment || '') + '</td>' +
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
            loadBundleTasks(bundleId);
          }).catch(function (err) {
            showError('Failed to update task: ' + err.message);
          });
        });
      });
    }).catch(function (err) {
      container.innerHTML = '';
      showError('Failed to load bundle tasks: ' + err.message);
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


  // ── Recurring View ──────────────────────────────────────────────

  var DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  function scheduleSummary(config) {
    if (config.schedule === 'daily') return 'Daily';
    if (config.schedule === 'weekly') return 'Weekly (' + DAY_NAMES[config.dayOfWeek] + ')';
    if (config.schedule === 'monthly') return 'Monthly (day ' + config.dayOfMonth + ')';
    return config.schedule;
  }

  function renderRecurring() {
    clearApp();

    var header = document.createElement('h2');
    header.textContent = 'Recurring Tasks';
    app.appendChild(header);

    // Create form
    var form = document.createElement('div');
    form.className = 'form-section';
    form.innerHTML =
      '<h3>New Recurring Config</h3>' +
      '<div class="form-row">' +
        '<div class="form-group">' +
          '<label for="rec-desc">Description</label>' +
          '<input type="text" id="rec-desc" placeholder="Task description" style="width:300px;" />' +
        '</div>' +
        '<div class="form-group">' +
          '<label for="rec-schedule">Schedule</label>' +
          '<select id="rec-schedule">' +
            '<option value="daily">Daily</option>' +
            '<option value="weekly">Weekly</option>' +
            '<option value="monthly">Monthly</option>' +
          '</select>' +
        '</div>' +
        '<div class="form-group" id="rec-day-group" style="display:none;">' +
          '<label for="rec-day" id="rec-day-label">Day</label>' +
          '<input type="number" id="rec-day" min="0" max="31" style="width:80px;padding:8px 10px;border:1px solid #ddd;border-radius:4px;font-size:14px;" />' +
        '</div>' +
        '<div class="form-group">' +
          '<label>&nbsp;</label>' +
          '<button class="btn-primary" id="rec-create-btn">Create</button>' +
        '</div>' +
      '</div>';
    app.appendChild(form);

    var scheduleSelect = document.getElementById('rec-schedule');
    var dayGroup = document.getElementById('rec-day-group');
    var dayInput = document.getElementById('rec-day');
    var dayLabel = document.getElementById('rec-day-label');

    function updateDayField() {
      var val = scheduleSelect.value;
      if (val === 'weekly') {
        dayGroup.style.display = '';
        dayLabel.textContent = 'Day of Week (0=Sun, 6=Sat)';
        dayInput.min = '0';
        dayInput.max = '6';
        dayInput.value = '';
      } else if (val === 'monthly') {
        dayGroup.style.display = '';
        dayLabel.textContent = 'Day of Month (1-31)';
        dayInput.min = '1';
        dayInput.max = '31';
        dayInput.value = '';
      } else {
        dayGroup.style.display = 'none';
        dayInput.value = '';
      }
    }

    scheduleSelect.addEventListener('change', updateDayField);

    document.getElementById('rec-create-btn').addEventListener('click', function () {
      var desc = document.getElementById('rec-desc').value.trim();
      var schedule = scheduleSelect.value;
      if (!desc) {
        showError('Description is required.');
        return;
      }
      var data = { description: desc, schedule: schedule };
      if (schedule === 'weekly') {
        data.dayOfWeek = parseInt(dayInput.value, 10);
      } else if (schedule === 'monthly') {
        data.dayOfMonth = parseInt(dayInput.value, 10);
      }
      api.recurring.create(data).then(function () {
        document.getElementById('rec-desc').value = '';
        dayInput.value = '';
        loadRecurring();
      }).catch(function (err) {
        showError('Failed to create recurring config: ' + err.message);
      });
    });

    // Generate section
    var genSection = document.createElement('div');
    genSection.className = 'form-section';
    genSection.innerHTML =
      '<h3>Generate Tasks</h3>' +
      '<div class="form-row">' +
        '<div class="form-group">' +
          '<label for="gen-start">Start Date</label>' +
          '<input type="date" id="gen-start" value="' + todayString() + '" />' +
        '</div>' +
        '<div class="form-group">' +
          '<label for="gen-end">End Date</label>' +
          '<input type="date" id="gen-end" value="' + todayString() + '" />' +
        '</div>' +
        '<div class="form-group">' +
          '<label>&nbsp;</label>' +
          '<button class="btn-primary" id="gen-btn">Generate</button>' +
        '</div>' +
      '</div>' +
      '<div id="gen-result" style="margin-top:12px;font-size:14px;"></div>';
    app.appendChild(genSection);

    document.getElementById('gen-btn').addEventListener('click', function () {
      var startDate = document.getElementById('gen-start').value;
      var endDate = document.getElementById('gen-end').value;
      var resultDiv = document.getElementById('gen-result');
      resultDiv.textContent = 'Generating...';
      api.recurring.generate({ startDate: startDate, endDate: endDate }).then(function (data) {
        var count = (data.generated || []).length;
        var skipped = data.skipped || 0;
        resultDiv.textContent = 'Generated ' + count + ' task(s), skipped ' + skipped + ' duplicate(s).';
      }).catch(function (err) {
        resultDiv.textContent = '';
        showError('Failed to generate tasks: ' + err.message);
      });
    });

    // Table container
    var tableContainer = document.createElement('div');
    tableContainer.id = 'recurring-table';
    app.appendChild(tableContainer);

    loadRecurring();
  }

  function loadRecurring() {
    var container = document.getElementById('recurring-table');
    if (!container) return;
    container.innerHTML = '<p>Loading...</p>';

    var banners = app.querySelectorAll('.error-banner');
    banners.forEach(function (b) { b.remove(); });

    api.recurring.list().then(function (data) {
      var configs = data.recurringConfigs || [];
      if (configs.length === 0) {
        container.innerHTML = '<div class="empty-state">No recurring configs yet. Create one to get started.</div>';
        return;
      }
      var html = '<table><thead><tr>' +
        '<th>Description</th><th>Schedule</th><th>Enabled</th><th>Actions</th>' +
        '</tr></thead><tbody>';
      configs.forEach(function (c) {
        var enabledText = c.enabled ? 'Yes' : 'No';
        html += '<tr>' +
          '<td>' + escapeHtml(c.description) + '</td>' +
          '<td>' + escapeHtml(scheduleSummary(c)) + '</td>' +
          '<td>' + enabledText + '</td>' +
          '<td>' +
            '<button class="btn-danger" data-delete-recurring="' + c.id + '" data-rec-desc="' + escapeHtml(c.description) + '">Delete</button>' +
          '</td>' +
          '</tr>';
      });
      html += '</tbody></table>';
      container.innerHTML = html;

      // Delete handlers
      container.querySelectorAll('[data-delete-recurring]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.getAttribute('data-delete-recurring');
          var desc = btn.getAttribute('data-rec-desc');
          if (!confirm('Delete recurring config: "' + desc + '"?')) return;
          api.recurring.delete(id).then(function () {
            loadRecurring();
          }).catch(function (err) {
            showError('Failed to delete: ' + err.message);
          });
        });
      });
    }).catch(function (err) {
      container.innerHTML = '';
      showError('Failed to load recurring configs: ' + err.message);
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

  function renderMarkdownLinks(str) {
    if (!str) return '';
    var escaped = escapeHtml(str);
    return escaped.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener">$1</a>');
  }
})();
