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
    '#/': renderDashboard,
    '#/tasks': renderTasks,
    '#/bundles': renderBundles,
    '#/templates': renderTemplates,
    '#/recurring': renderRecurring,
  };

  function navigate() {
    var hash = location.hash || '';
    var handler = routes[hash];
    if (!handler) {
      location.hash = '#/';
      return;
    }
    // Toggle wide layout for dashboard
    if (hash === '#/') {
      app.classList.add('dashboard-wide');
    } else {
      app.classList.remove('dashboard-wide');
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

  // ── Dashboard View ─────────────────────────────────────────────

  var GRACE_ID = '00000000-0000-0000-0000-000000000001';
  var dashboardState = {
    assignedToMe: true,
    currentUserId: GRACE_ID,
    bundleSortMode: 'date', // 'date' | 'stage' | 'template'
  };

  function renderDashboard() {
    clearApp();

    // Notification bar
    var notificationBar = document.createElement('div');
    notificationBar.className = 'notification-bar';
    notificationBar.id = 'notification-bar';
    app.appendChild(notificationBar);

    // Load notifications (graceful on 404)
    loadNotifications();

    // Two-column layout
    var layout = document.createElement('div');
    layout.className = 'dashboard-layout';

    var leftCol = document.createElement('div');
    leftCol.className = 'dashboard-left';

    var rightCol = document.createElement('div');
    rightCol.className = 'dashboard-right';

    // Left column header
    var leftHeader = document.createElement('h3');
    leftHeader.textContent = 'Active Bundles';
    leftHeader.style.cssText = 'margin-bottom:12px;font-size:16px;font-weight:600;';
    leftCol.appendChild(leftHeader);

    // Sort control
    var sortControl = document.createElement('div');
    sortControl.className = 'bundle-sort-control';
    sortControl.setAttribute('data-testid', 'bundle-sort-control');

    var sortModes = [
      { mode: 'date', label: 'Date', testid: 'sort-btn-date' },
      { mode: 'stage', label: 'Stage', testid: 'sort-btn-stage' },
      { mode: 'template', label: 'Template', testid: 'sort-btn-template' },
    ];

    sortModes.forEach(function (item) {
      var btn = document.createElement('button');
      btn.className = 'bundle-sort-btn' + (dashboardState.bundleSortMode === item.mode ? ' active' : '');
      btn.textContent = item.label;
      btn.setAttribute('data-testid', item.testid);
      btn.addEventListener('click', function () {
        if (dashboardState.bundleSortMode === item.mode) return;
        dashboardState.bundleSortMode = item.mode;
        // Update active button
        sortControl.querySelectorAll('.bundle-sort-btn').forEach(function (b) {
          b.classList.remove('active');
        });
        btn.classList.add('active');
        loadDashboardBundles();
      });
      sortControl.appendChild(btn);
    });

    leftCol.appendChild(sortControl);

    var bundlesContainer = document.createElement('div');
    bundlesContainer.id = 'dashboard-bundles';
    bundlesContainer.innerHTML = '<p>Loading...</p>';
    leftCol.appendChild(bundlesContainer);

    // Right column header with assigned-to-me toggle and user picker
    var rightHeader = document.createElement('div');
    rightHeader.className = 'dashboard-header';
    rightHeader.innerHTML =
      '<h3>Today\'s Tasks</h3>' +
      '<select id="dashboard-user-picker" class="user-picker"></select>' +
      '<label class="assigned-toggle">' +
        '<input type="checkbox" id="assigned-to-me" ' + (dashboardState.assignedToMe ? 'checked' : '') + ' />' +
        'Assigned to me' +
      '</label>';
    rightCol.appendChild(rightHeader);

    var tasksContainer = document.createElement('div');
    tasksContainer.id = 'dashboard-tasks';
    tasksContainer.innerHTML = '<p>Loading...</p>';
    rightCol.appendChild(tasksContainer);

    layout.appendChild(leftCol);
    layout.appendChild(rightCol);
    app.appendChild(layout);

    // Populate user picker
    loadUsersOnce().then(function (usersMap) {
      var picker = document.getElementById('dashboard-user-picker');
      if (!picker) return;
      Object.keys(usersMap).forEach(function (uid) {
        var opt = document.createElement('option');
        opt.value = uid;
        opt.textContent = usersMap[uid].name;
        if (uid === dashboardState.currentUserId) opt.selected = true;
        picker.appendChild(opt);
      });

      picker.addEventListener('change', function () {
        dashboardState.currentUserId = picker.value;
        loadDashboardTasks();
      });
    });

    // Toggle assigned-to-me
    var toggleEl = document.getElementById('assigned-to-me');
    if (toggleEl) {
      toggleEl.addEventListener('change', function () {
        dashboardState.assignedToMe = toggleEl.checked;
        loadDashboardTasks();
      });
    }

    // Load data
    loadDashboardBundles();
    loadDashboardTasks();
  }

  function loadNotifications() {
    var bar = document.getElementById('notification-bar');
    if (!bar) return;

    api.notifications.list().then(function (data) {
      var notifications = data.notifications || [];
      if (notifications.length === 0) {
        bar.innerHTML = '';
        return;
      }
      bar.innerHTML = '';
      notifications.forEach(function (n) {
        var item = document.createElement('div');
        item.className = 'notification-item';
        item.setAttribute('data-notification-id', n.id);
        var msgSpan = document.createElement('span');
        msgSpan.textContent = n.message;
        item.appendChild(msgSpan);
        var dismissBtn = document.createElement('button');
        dismissBtn.textContent = 'Dismiss';
        dismissBtn.addEventListener('click', function () {
          api.notifications.dismiss(n.id).then(function () {
            item.remove();
          }).catch(function () {
            // silently ignore
          });
        });
        item.appendChild(dismissBtn);
        bar.appendChild(item);
      });
    }).catch(function () {
      // Gracefully hide if API not available (404)
      bar.innerHTML = '';
    });
  }

  // Stage display labels (for stage mode headings)
  var STAGE_ORDER = ['preparation', 'announced', 'after-event', 'done'];
  var STAGE_LABELS = {
    'preparation': 'Preparation',
    'announced': 'Announced',
    'after-event': 'After Event',
    'done': 'Done',
  };

  // Sort helper: ascending by anchorDate, no-date sorts to end
  function anchorDateCompare(a, b) {
    var da = a.anchorDate || '';
    var db = b.anchorDate || '';
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return da.localeCompare(db);
  }

  function renderBundleCard(b, taskMap) {
    var tasks = taskMap[b.id] || [];
    var doneCount = tasks.filter(function (t) { return t.status === 'done'; }).length;
    var totalCount = tasks.length;

    var card = document.createElement('div');
    card.className = 'dashboard-bundle-card';
    card.setAttribute('data-bundle-id', b.id);

    // Title line with emoji + anchor date on same line
    var titleDiv = document.createElement('div');
    titleDiv.className = 'dashboard-bundle-card-title';
    var titleText = document.createElement('span');
    titleText.textContent = (b.emoji ? b.emoji + ' ' : '') + (b.title || 'Untitled');
    titleDiv.appendChild(titleText);
    if (b.anchorDate) {
      var dateBadge = document.createElement('span');
      dateBadge.className = 'badge-anchor-date';
      dateBadge.textContent = b.anchorDate;
      titleDiv.appendChild(dateBadge);
    }
    card.appendChild(titleDiv);

    // Meta row: tags, progress, stage
    var metaDiv = document.createElement('div');
    metaDiv.className = 'dashboard-bundle-card-meta';

    // Tags
    (b.tags || []).forEach(function (tag) {
      var tagBadge = document.createElement('span');
      tagBadge.className = 'badge-tag';
      tagBadge.textContent = tag;
      metaDiv.appendChild(tagBadge);
    });

    // Progress
    var progressBadge = document.createElement('span');
    var allDone = totalCount > 0 && doneCount === totalCount;
    progressBadge.className = 'progress-badge' + (allDone ? ' all-done' : '');
    progressBadge.textContent = doneCount + '/' + totalCount + ' done';
    metaDiv.appendChild(progressBadge);

    // Stage
    var stage = b.stage || 'preparation';
    var stageBadge = document.createElement('span');
    stageBadge.className = 'badge-stage ' + stage;
    stageBadge.textContent = stage;
    metaDiv.appendChild(stageBadge);

    card.appendChild(metaDiv);

    // Click handler
    card.addEventListener('click', function () {
      currentBundleId = b.id;
      location.hash = '#/bundles';
    });

    return card;
  }

  function renderBundlesDate(container, bundles, taskMap) {
    // Flat list sorted by anchorDate ascending, no headings
    var sorted = bundles.slice().sort(anchorDateCompare);
    sorted.forEach(function (b) {
      container.appendChild(renderBundleCard(b, taskMap));
    });
  }

  function renderBundlesStage(container, bundles, taskMap) {
    // Group by stage, only show non-empty stages, in fixed order
    var groups = {};
    bundles.forEach(function (b) {
      var stage = b.stage || 'preparation';
      if (!groups[stage]) groups[stage] = [];
      groups[stage].push(b);
    });

    STAGE_ORDER.forEach(function (stage) {
      if (!groups[stage] || groups[stage].length === 0) return;
      var heading = document.createElement('div');
      heading.className = 'bundle-group-heading';
      heading.textContent = STAGE_LABELS[stage] || stage;
      container.appendChild(heading);

      var sorted = groups[stage].slice().sort(anchorDateCompare);
      sorted.forEach(function (b) {
        container.appendChild(renderBundleCard(b, taskMap));
      });
    });
  }

  function renderBundlesTemplate(container, bundles, taskMap, templateMap) {
    // Group by templateId, "Other" last, sorted by name within groups
    var groups = {};
    bundles.forEach(function (b) {
      var key = b.templateId || '__other__';
      if (!groups[key]) groups[key] = [];
      groups[key].push(b);
    });

    var groupKeys = Object.keys(groups);
    groupKeys.sort(function (a, b) {
      if (a === '__other__') return 1;
      if (b === '__other__') return -1;
      var nameA = templateMap[a] ? templateMap[a].name : a;
      var nameB = templateMap[b] ? templateMap[b].name : b;
      return nameA.localeCompare(nameB);
    });

    groupKeys.forEach(function (key) {
      var heading = document.createElement('div');
      heading.className = 'bundle-group-heading';
      if (key === '__other__') {
        heading.textContent = 'Other';
      } else {
        var tpl = templateMap[key];
        heading.textContent = tpl ? (tpl.emoji ? tpl.emoji + ' ' : '') + tpl.name : 'Unknown Template';
      }
      container.appendChild(heading);

      var sorted = groups[key].slice().sort(anchorDateCompare);
      sorted.forEach(function (b) {
        container.appendChild(renderBundleCard(b, taskMap));
      });
    });
  }

  function loadDashboardBundles() {
    var container = document.getElementById('dashboard-bundles');
    if (!container) return;

    Promise.all([
      api.bundles.list(),
      api.templates.list()
    ]).then(function (results) {
      var allBundles = results[0].bundles || [];
      var templates = results[1].templates || [];

      // Filter to active bundles
      var bundles = allBundles.filter(function (b) {
        return b.status === 'active';
      });

      if (bundles.length === 0) {
        container.innerHTML = '<div class="empty-state">No active bundles</div>';
        return;
      }

      // Build template map
      var templateMap = {};
      templates.forEach(function (t) {
        templateMap[t.id] = t;
      });

      // Fetch tasks for progress calculation
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

        var mode = dashboardState.bundleSortMode || 'date';
        if (mode === 'date') {
          renderBundlesDate(container, bundles, taskMap);
        } else if (mode === 'stage') {
          renderBundlesStage(container, bundles, taskMap);
        } else {
          renderBundlesTemplate(container, bundles, taskMap, templateMap);
        }
      });
    }).catch(function (err) {
      container.innerHTML = '';
      showError('Failed to load bundles: ' + err.message);
    });
  }

  function loadDashboardTasks() {
    var container = document.getElementById('dashboard-tasks');
    if (!container) return;
    container.innerHTML = '<p>Loading...</p>';

    var today = todayString();

    Promise.all([
      api.tasks.list({ date: today }),
      loadUsersOnce()
    ]).then(function (results) {
      var data = results[0];
      var usersMap = results[1];
      var tasks = data.tasks || [];

      // Apply assigned-to-me filter
      if (dashboardState.assignedToMe && dashboardState.currentUserId) {
        tasks = tasks.filter(function (t) {
          return t.assigneeId === dashboardState.currentUserId;
        });
      }

      if (tasks.length === 0) {
        container.innerHTML = '<div class="empty-state">No tasks for today</div>';
        return;
      }

      // Sort by date ascending
      tasks.sort(function (a, b) {
        if (a.date < b.date) return -1;
        if (a.date > b.date) return 1;
        return 0;
      });

      // Collect unique bundleIds
      var bundleIds = [];
      tasks.forEach(function (t) {
        if (t.bundleId && bundleIds.indexOf(t.bundleId) === -1) {
          bundleIds.push(t.bundleId);
        }
      });

      var bundlePromises = bundleIds.map(function (bid) {
        return api.bundles.get(bid).then(function (d) {
          return { id: bid, title: d.bundle.title || 'Untitled' };
        }).catch(function () {
          return { id: bid, title: 'Unknown' };
        });
      });

      Promise.all(bundlePromises).then(function (bundleResults) {
        var bundleMap = {};
        bundleResults.forEach(function (b) {
          bundleMap[b.id] = b.title;
        });

        renderDashboardTaskTable(tasks, bundleMap, usersMap, container);
      });
    }).catch(function (err) {
      container.innerHTML = '';
      showError('Failed to load tasks: ' + err.message);
    });
  }

  function renderDashboardTaskTable(tasks, bundleMap, usersMap, container) {
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
        checkboxDisabled = ' disabled title="Fill in ' + escapeHtml(t.requiredLinkName) + ' link first"';
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
        '<td class="task-description">' + renderMarkdownLinks(t.description) + '</td>' +
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
          loadDashboardTasks();
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
          loadDashboardTasks();
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
      inp.addEventListener('click', function (e) {
        e.stopPropagation();
      });
    });
  }

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

  // Stage transition map: current stage -> { label, nextStage }
  var stageTransitions = {
    'preparation': { label: 'Mark Announced', nextStage: 'announced' },
    'announced': { label: 'Mark After-Event', nextStage: 'after-event' },
    'after-event': { label: 'Mark Done', nextStage: 'done' },
  };

  function renderBundleDetail(bundleId) {
    var backBtn = document.createElement('button');
    backBtn.className = 'btn-back';
    backBtn.textContent = '\u2190 Back to Home';
    backBtn.addEventListener('click', function () {
      currentBundleId = null;
      location.hash = '#/';
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

    // Load bundle, tasks, and users in parallel
    Promise.all([
      api.bundles.get(bundleId),
      api.bundles.tasks(bundleId),
      loadUsersOnce()
    ]).then(function (results) {
      var bundle = results[0].bundle;
      var tasks = results[1].tasks || [];
      var usersMap = results[2];

      // Sort tasks by date ascending
      tasks.sort(function (a, b) {
        return (a.date || '').localeCompare(b.date || '');
      });

      var doneCount = tasks.filter(function (t) { return t.status === 'done'; }).length;
      var totalCount = tasks.length;

      container.innerHTML = '';

      // ── Header: emoji + title ──
      var headerDiv = document.createElement('div');
      headerDiv.className = 'bundle-detail-header';

      var titleEl = document.createElement('h2');
      titleEl.textContent = (bundle.emoji ? bundle.emoji + ' ' : '') + (bundle.title || '');
      headerDiv.appendChild(titleEl);
      container.appendChild(headerDiv);

      // ── Badges row: anchor date, stage, status, progress ──
      var badgesDiv = document.createElement('div');
      badgesDiv.className = 'bundle-detail-badges';

      if (bundle.anchorDate) {
        var anchorBadge = document.createElement('span');
        anchorBadge.className = 'badge-anchor-date';
        anchorBadge.textContent = bundle.anchorDate;
        badgesDiv.appendChild(anchorBadge);
      }

      var stage = bundle.stage || 'preparation';
      var stageBadge = document.createElement('span');
      stageBadge.className = 'badge-stage ' + stage;
      stageBadge.textContent = stage === 'after-event' ? 'after-event' : stage;
      stageBadge.setAttribute('data-testid', 'stage-badge');
      badgesDiv.appendChild(stageBadge);

      // Stage transition button
      var transition = stageTransitions[stage];
      if (transition) {
        var stageBtn = document.createElement('button');
        stageBtn.className = 'btn-stage';
        stageBtn.textContent = transition.label;
        stageBtn.setAttribute('data-testid', 'stage-transition-btn');
        stageBtn.addEventListener('click', function () {
          api.bundles.update(bundleId, { stage: transition.nextStage }).then(function () {
            loadBundleDetail(bundleId);
          }).catch(function (err) {
            showError('Failed to update stage: ' + err.message);
          });
        });
        badgesDiv.appendChild(stageBtn);
      }

      var statusBadge = document.createElement('span');
      statusBadge.className = 'badge-status ' + (bundle.status || 'active');
      statusBadge.textContent = bundle.status || 'active';
      badgesDiv.appendChild(statusBadge);

      var progressBadgeClass = 'progress-badge' + (totalCount > 0 && doneCount === totalCount ? ' all-done' : '');
      var progressBadge = document.createElement('span');
      progressBadge.className = progressBadgeClass;
      progressBadge.textContent = doneCount + '/' + totalCount + ' done';
      progressBadge.setAttribute('data-testid', 'progress-badge');
      badgesDiv.appendChild(progressBadge);

      container.appendChild(badgesDiv);

      // ── Description ──
      if (bundle.description) {
        var descDiv = document.createElement('div');
        descDiv.className = 'bundle-detail-desc';
        descDiv.innerHTML = renderMarkdownLinks(bundle.description);
        container.appendChild(descDiv);
      }

      // ── References section (read-only) ──
      var refs = bundle.references || [];
      if (refs.length > 0) {
        var refsSection = document.createElement('div');
        refsSection.className = 'references-section';
        var refsHeader = document.createElement('h3');
        refsHeader.textContent = 'References';
        refsSection.appendChild(refsHeader);

        refs.forEach(function (ref) {
          var a = document.createElement('a');
          a.className = 'reference-link';
          a.href = ref.url || '#';
          a.target = '_blank';
          a.rel = 'noopener';
          a.textContent = ref.name || ref.url;
          refsSection.appendChild(a);
        });

        container.appendChild(refsSection);
      }

      // ── Bundle Links section (editable) ──
      var bundleLinksSection = document.createElement('div');
      bundleLinksSection.className = 'bundle-links-editable';
      var blHeader = document.createElement('h3');
      blHeader.textContent = 'Bundle Links';
      bundleLinksSection.appendChild(blHeader);

      var currentBundleLinks = bundle.bundleLinks || [];

      currentBundleLinks.forEach(function (bl, idx) {
        var row = document.createElement('div');
        var isEmpty = !bl.url || !bl.url.trim();
        row.className = 'bundle-link-row' + (isEmpty ? ' bundle-link-row--empty' : '');

        var label = document.createElement('span');
        label.className = 'bundle-link-label';
        label.textContent = bl.name;
        row.appendChild(label);

        var urlInput = document.createElement('input');
        urlInput.type = 'text';
        urlInput.className = 'bundle-link-url-input';
        urlInput.placeholder = 'https://...';
        urlInput.value = bl.url || '';
        urlInput.setAttribute('data-link-index', idx);
        row.appendChild(urlInput);

        var saveBtn = document.createElement('button');
        saveBtn.className = 'btn-save-link';
        saveBtn.textContent = 'Save';
        saveBtn.setAttribute('data-link-save-index', idx);
        saveBtn.addEventListener('click', function () {
          var newUrl = urlInput.value.trim();
          var updatedLinks = currentBundleLinks.map(function (link, i) {
            if (i === idx) {
              return { name: link.name, url: newUrl };
            }
            return { name: link.name, url: link.url };
          });
          api.bundles.update(bundleId, { bundleLinks: updatedLinks }).then(function () {
            loadBundleDetail(bundleId);
          }).catch(function (err) {
            showError('Failed to save link: ' + err.message);
          });
        });
        row.appendChild(saveBtn);

        bundleLinksSection.appendChild(row);
      });

      // Add link form
      var addLinkForm = document.createElement('div');
      addLinkForm.className = 'add-link-form';
      addLinkForm.innerHTML =
        '<input type="text" id="add-bl-name" placeholder="Link name" style="width:130px;" />' +
        '<input type="text" id="add-bl-url" placeholder="https://..." style="width:250px;" />' +
        '<button class="btn-primary" id="add-bl-btn" style="padding:5px 12px;font-size:12px;">Add</button>';
      bundleLinksSection.appendChild(addLinkForm);
      container.appendChild(bundleLinksSection);

      // Add link handler
      setTimeout(function () {
        var addBtn = document.getElementById('add-bl-btn');
        if (addBtn) {
          addBtn.addEventListener('click', function () {
            var name = document.getElementById('add-bl-name').value.trim();
            var url = document.getElementById('add-bl-url').value.trim();
            if (!name) {
              showError('Link name is required.');
              return;
            }
            var updatedLinks = currentBundleLinks.map(function (l) {
              return { name: l.name, url: l.url };
            });
            updatedLinks.push({ name: name, url: url || '' });
            api.bundles.update(bundleId, { bundleLinks: updatedLinks }).then(function () {
              loadBundleDetail(bundleId);
            }).catch(function (err) {
              showError('Failed to add link: ' + err.message);
            });
          });
        }
      }, 0);

      // ── Tasks table ──
      var tasksHeader = document.createElement('h3');
      tasksHeader.textContent = 'Tasks';
      tasksHeader.style.marginBottom = '12px';
      container.appendChild(tasksHeader);

      var tasksContainer = document.createElement('div');
      tasksContainer.id = 'bundle-tasks-table';
      container.appendChild(tasksContainer);

      renderBundleTasksTable(bundleId, tasks, usersMap, bundle);
    }).catch(function (err) {
      container.innerHTML = '';
      showError('Failed to load bundle: ' + err.message);
    });
  }

  function renderBundleTasksTable(bundleId, tasks, usersMap, bundle) {
    var container = document.getElementById('bundle-tasks-table');
    if (!container) return;

    container.innerHTML = '';

    if (tasks.length === 0) {
      container.innerHTML = '<div class="empty-state">No tasks for this bundle.</div>';
      return;
    }

    // Keep backward-compat class on the container div
    container.className = 'bundle-tasks-table task-checklist';

    // Split tasks: active (not done) sorted by date, done at the bottom
    var activeTasks = tasks.filter(function (t) { return t.status !== 'done'; });
    var doneTasks = tasks.filter(function (t) { return t.status === 'done'; });

    function buildTaskRow(t) {
      var isDone = t.status === 'done';
      var hasRequiredLink = !!t.requiredLinkName;
      var linkFilled = !!(t.link && t.link.trim());
      var checkboxDisabled = hasRequiredLink && !linkFilled;
      // A task is a milestone if it has stageOnComplete set
      var isMilestone = !!t.stageOnComplete;

      var rowClasses = 'task-checklist-row';
      if (isDone) rowClasses += ' task-done';
      if (isMilestone) rowClasses += ' milestone-task-row';

      var row = document.createElement('div');
      row.className = rowClasses;
      row.setAttribute('data-task-row', t.id);
      if (isMilestone) row.setAttribute('data-testid', 'milestone-task-row');

      // ── Checkbox column ──
      var checkboxCol = document.createElement('div');
      checkboxCol.className = 'task-checklist-checkbox-col';

      var checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'task-status-checkbox';
      checkbox.checked = isDone;
      checkbox.disabled = checkboxDisabled;
      checkbox.setAttribute('data-task-checkbox', t.id);
      checkbox.addEventListener('change', function () {
        var newStatus = checkbox.checked ? 'done' : 'todo';
        api.tasks.update(t.id, { status: newStatus }).then(function () {
          loadBundleDetail(bundleId);
        }).catch(function (err) {
          showError('Failed to update task: ' + err.message);
          checkbox.checked = !checkbox.checked;
        });
      });
      checkboxCol.appendChild(checkbox);
      row.appendChild(checkboxCol);

      // ── Body column ──
      var body = document.createElement('div');
      body.className = 'task-checklist-body';

      // Main line: description + instructions icon
      var mainLine = document.createElement('div');
      mainLine.className = 'task-checklist-main-line';

      var descSpan = document.createElement('span');
      descSpan.className = 'task-description';
      descSpan.innerHTML = renderMarkdownLinks(t.description || '');
      mainLine.appendChild(descSpan);

      if (t.instructionsUrl) {
        var instrLink = document.createElement('a');
        instrLink.className = 'instructions-link';
        instrLink.href = t.instructionsUrl;
        instrLink.target = '_blank';
        instrLink.rel = 'noopener';
        instrLink.title = 'Instructions';
        instrLink.innerHTML = '&#x1F4CB;';
        mainLine.appendChild(instrLink);
      }

      body.appendChild(mainLine);

      // Meta line: date + assignee
      var metaLine = document.createElement('div');
      metaLine.className = 'task-checklist-meta';

      if (t.date) {
        var dateSpan = document.createElement('span');
        dateSpan.className = 'task-meta-date';
        dateSpan.textContent = t.date;
        metaLine.appendChild(dateSpan);
      }

      if (t.assigneeId && usersMap[t.assigneeId]) {
        var assigneeBadge = document.createElement('span');
        assigneeBadge.className = 'badge-assignee';
        assigneeBadge.textContent = usersMap[t.assigneeId].name;
        metaLine.appendChild(assigneeBadge);
      }

      if (metaLine.hasChildNodes()) {
        body.appendChild(metaLine);
      }

      // Required link input inline under description
      if (hasRequiredLink) {
        var wrapper = document.createElement('div');
        wrapper.className = 'required-link-wrapper';
        wrapper.style.marginTop = '4px';

        var linkLabel = document.createElement('span');
        linkLabel.className = 'required-link-label';
        linkLabel.textContent = t.requiredLinkName + ':';
        wrapper.appendChild(linkLabel);

        var linkInput = document.createElement('input');
        linkInput.type = 'text';
        linkInput.className = 'required-link-input';
        linkInput.placeholder = 'https://...';
        linkInput.value = t.link || '';
        linkInput.setAttribute('data-required-link-task', t.id);
        wrapper.appendChild(linkInput);

        var saveReqBtn = document.createElement('button');
        saveReqBtn.className = 'btn-save-link';
        saveReqBtn.textContent = 'Save';
        saveReqBtn.style.fontSize = '11px';
        saveReqBtn.style.padding = '2px 8px';
        saveReqBtn.setAttribute('data-save-required-link', t.id);
        saveReqBtn.addEventListener('click', (function (task) {
          return function () {
            var input = container.querySelector('[data-required-link-task="' + task.id + '"]');
            var newUrl = input ? input.value.trim() : '';

            // Update task link
            var taskUpdatePromise = api.tasks.update(task.id, { link: newUrl });

            // Also update the bundle's bundleLinks entry
            var currentLinks = (bundle.bundleLinks || []).map(function (bl) {
              if (bl.name === task.requiredLinkName) {
                return { name: bl.name, url: newUrl };
              }
              return { name: bl.name, url: bl.url };
            });
            var bundleUpdatePromise = api.bundles.update(bundleId, { bundleLinks: currentLinks });

            Promise.all([taskUpdatePromise, bundleUpdatePromise]).then(function () {
              loadBundleDetail(bundleId);
            }).catch(function (err) {
              showError('Failed to save link: ' + err.message);
            });
          };
        })(t));
        wrapper.appendChild(saveReqBtn);

        body.appendChild(wrapper);
      }

      row.appendChild(body);
      return row;
    }

    // Render active tasks
    activeTasks.forEach(function (t) {
      container.appendChild(buildTaskRow(t));
    });

    // Render done tasks in a separate section
    if (doneTasks.length > 0) {
      var doneHeading = document.createElement('div');
      doneHeading.className = 'task-section-heading';
      doneHeading.textContent = 'Done (' + doneTasks.length + ')';
      container.appendChild(doneHeading);

      doneTasks.forEach(function (t) {
        container.appendChild(buildTaskRow(t));
      });
    }
  }

  // ── Templates View ──────────────────────────────────────────────

  var currentTemplateId = null;

  function renderTemplates() {
    clearApp();

    if (currentTemplateId) {
      renderTemplateEditor(currentTemplateId);
      return;
    }

    var header = document.createElement('h2');
    header.textContent = 'Templates';
    app.appendChild(header);

    var cardsContainer = document.createElement('div');
    cardsContainer.id = 'templates-container';
    app.appendChild(cardsContainer);

    loadTemplateCards();
  }

  function loadTemplateCards() {
    var container = document.getElementById('templates-container');
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

      container.innerHTML = '';
      var cardsDiv = document.createElement('div');
      cardsDiv.className = 'template-cards';

      templates.forEach(function (t) {
        var taskCount = (t.taskDefinitions && t.taskDefinitions.length) || 0;
        var triggerType = t.triggerType || 'manual';
        var tags = t.tags || [];

        var card = document.createElement('div');
        card.className = 'template-card';
        card.setAttribute('data-template-id', t.id);

        var titleText = (t.emoji ? t.emoji + ' ' : '') + escapeHtml(t.name || 'Unnamed');
        var titleDiv = document.createElement('div');
        titleDiv.className = 'template-card-title';
        titleDiv.innerHTML = titleText;
        card.appendChild(titleDiv);

        var metaDiv = document.createElement('div');
        metaDiv.className = 'template-card-meta';

        if (t.type) {
          var typeBadge = document.createElement('span');
          typeBadge.className = 'badge-type';
          typeBadge.textContent = t.type;
          metaDiv.appendChild(typeBadge);
        }

        tags.forEach(function (tag) {
          var tagBadge = document.createElement('span');
          tagBadge.className = 'badge-tag';
          tagBadge.textContent = tag;
          metaDiv.appendChild(tagBadge);
        });

        var triggerBadge = document.createElement('span');
        triggerBadge.className = 'badge-trigger ' + triggerType;
        triggerBadge.textContent = triggerType;
        metaDiv.appendChild(triggerBadge);

        card.appendChild(metaDiv);

        var tasksDiv = document.createElement('div');
        tasksDiv.className = 'template-card-tasks';
        tasksDiv.textContent = taskCount + ' task' + (taskCount !== 1 ? 's' : '');
        card.appendChild(tasksDiv);

        card.addEventListener('click', function () {
          currentTemplateId = t.id;
          renderTemplates();
        });

        cardsDiv.appendChild(card);
      });

      container.appendChild(cardsDiv);
    }).catch(function (err) {
      container.innerHTML = '';
      showError('Failed to load templates: ' + err.message);
    });
  }

  function renderTemplateEditor(templateId) {
    var backBtn = document.createElement('button');
    backBtn.className = 'btn-back';
    backBtn.textContent = '\u2190 Back to Templates';
    backBtn.addEventListener('click', function () {
      currentTemplateId = null;
      renderTemplates();
    });
    app.appendChild(backBtn);

    var editorContainer = document.createElement('div');
    editorContainer.id = 'template-editor-container';
    editorContainer.innerHTML = '<p>Loading...</p>';
    app.appendChild(editorContainer);

    // Load template and users in parallel
    Promise.all([
      api.templates.get(templateId),
      api.users.list()
    ]).then(function (results) {
      var template = results[0].template;
      var users = (results[1] && results[1].users) || [];
      buildTemplateEditorForm(template, users, editorContainer);
    }).catch(function (err) {
      editorContainer.innerHTML = '';
      showError('Failed to load template: ' + err.message);
    });
  }

  function buildTemplateEditorForm(template, users, container) {
    container.innerHTML = '';

    var editor = document.createElement('div');
    editor.className = 'template-editor';

    // ---- Basic Info Section ----
    var basicH3 = document.createElement('h3');
    basicH3.textContent = 'Basic Info';
    editor.appendChild(basicH3);

    var basicRow = document.createElement('div');
    basicRow.className = 'editor-row';
    basicRow.innerHTML =
      '<div class="editor-group">' +
        '<label for="tpl-name">Name</label>' +
        '<input type="text" id="tpl-name" value="' + escapeHtml(template.name || '') + '" style="width:200px;" />' +
      '</div>' +
      '<div class="editor-group">' +
        '<label for="tpl-type">Type</label>' +
        '<input type="text" id="tpl-type" value="' + escapeHtml(template.type || '') + '" style="width:150px;" />' +
      '</div>' +
      '<div class="editor-group">' +
        '<label for="tpl-emoji">Emoji</label>' +
        '<input type="text" id="tpl-emoji" value="' + escapeHtml(template.emoji || '') + '" style="width:60px;" />' +
      '</div>' +
      '<div class="editor-group">' +
        '<label for="tpl-tags">Tags (comma-separated)</label>' +
        '<input type="text" id="tpl-tags" value="' + escapeHtml((template.tags || []).join(', ')) + '" style="width:200px;" />' +
      '</div>' +
      '<div class="editor-group">' +
        '<label for="tpl-assignee">Default Assignee</label>' +
        '<select id="tpl-assignee"></select>' +
      '</div>';
    editor.appendChild(basicRow);

    // Populate assignee dropdown after DOM insertion
    setTimeout(function () {
      var assigneeSelect = document.getElementById('tpl-assignee');
      if (assigneeSelect) {
        assigneeSelect.innerHTML = '<option value="">(none)</option>';
        users.forEach(function (u) {
          var opt = document.createElement('option');
          opt.value = u.id;
          opt.textContent = u.name;
          if (template.defaultAssigneeId === u.id) opt.selected = true;
          assigneeSelect.appendChild(opt);
        });
      }
    }, 0);

    // ---- Trigger Config Section ----
    var triggerH3 = document.createElement('h3');
    triggerH3.textContent = 'Trigger Config';
    editor.appendChild(triggerH3);

    var triggerDiv = document.createElement('div');
    var isAutomatic = template.triggerType === 'automatic';
    triggerDiv.innerHTML =
      '<div class="radio-group">' +
        '<label><input type="radio" name="tpl-trigger" value="manual"' + (!isAutomatic ? ' checked' : '') + ' /> Manual</label>' +
        '<label><input type="radio" name="tpl-trigger" value="automatic"' + (isAutomatic ? ' checked' : '') + ' /> Automatic</label>' +
      '</div>' +
      '<div class="trigger-fields" id="trigger-auto-fields" style="display:' + (isAutomatic ? 'block' : 'none') + ';">' +
        '<div class="editor-row">' +
          '<div class="editor-group">' +
            '<label for="tpl-cron">Cron Expression</label>' +
            '<input type="text" id="tpl-cron" value="' + escapeHtml(template.triggerSchedule || '') + '" style="width:200px;" placeholder="0 9 * * 1" />' +
          '</div>' +
          '<div class="editor-group">' +
            '<label for="tpl-lead-days">Lead Days</label>' +
            '<input type="number" id="tpl-lead-days" value="' + (template.triggerLeadDays != null ? template.triggerLeadDays : '') + '" style="width:100px;" />' +
          '</div>' +
        '</div>' +
        '<div style="font-size:12px;color:#888;margin-top:4px;">Example: 0 9 * * 1 = Every Monday at 9am</div>' +
      '</div>';
    editor.appendChild(triggerDiv);

    // Toggle trigger fields visibility
    setTimeout(function () {
      var radios = document.querySelectorAll('input[name="tpl-trigger"]');
      radios.forEach(function (r) {
        r.addEventListener('change', function () {
          var autoFields = document.getElementById('trigger-auto-fields');
          if (autoFields) {
            autoFields.style.display = r.value === 'automatic' ? 'block' : 'none';
          }
        });
      });
    }, 0);

    // ---- References Section ----
    var refsH3 = document.createElement('h3');
    refsH3.textContent = 'References';
    editor.appendChild(refsH3);

    var refsContainer = document.createElement('div');
    refsContainer.id = 'tpl-references-list';
    editor.appendChild(refsContainer);

    var addRefBtn = document.createElement('button');
    addRefBtn.className = 'btn-add';
    addRefBtn.textContent = '+ Add Reference';
    addRefBtn.addEventListener('click', function () {
      addReferenceRow(refsContainer, '', '');
    });
    editor.appendChild(addRefBtn);

    // ---- Bundle Link Definitions Section ----
    var bldH3 = document.createElement('h3');
    bldH3.textContent = 'Bundle Link Definitions';
    editor.appendChild(bldH3);

    var bldContainer = document.createElement('div');
    bldContainer.id = 'tpl-bundlelinks-list';
    editor.appendChild(bldContainer);

    var addBldBtn = document.createElement('button');
    addBldBtn.className = 'btn-add';
    addBldBtn.textContent = '+ Add Bundle Link';
    addBldBtn.addEventListener('click', function () {
      addBundleLinkRow(bldContainer, '');
    });
    editor.appendChild(addBldBtn);

    // ---- Task Definitions Section ----
    var tdH3 = document.createElement('h3');
    tdH3.textContent = 'Task Definitions';
    editor.appendChild(tdH3);

    var tdContainer = document.createElement('div');
    tdContainer.id = 'tpl-taskdefs-list';
    editor.appendChild(tdContainer);

    var addTdBtn = document.createElement('button');
    addTdBtn.className = 'btn-add';
    addTdBtn.id = 'add-task-def-btn';
    addTdBtn.textContent = '+ Add Task';
    addTdBtn.addEventListener('click', function () {
      var count = tdContainer.querySelectorAll('.task-def-item').length;
      addTaskDefItem(tdContainer, {
        refId: 'task-' + (count + 1),
        description: '',
        offsetDays: 0
      }, users);
    });
    editor.appendChild(addTdBtn);

    // ---- Save Bar ----
    var saveBar = document.createElement('div');
    saveBar.className = 'save-bar';
    saveBar.innerHTML =
      '<button class="btn-primary" id="tpl-save-btn">Save</button>' +
      '<span class="save-feedback" id="tpl-save-feedback"></span>';
    editor.appendChild(saveBar);

    container.appendChild(editor);

    // Populate references
    var refs = template.references || [];
    refs.forEach(function (ref) {
      addReferenceRow(refsContainer, ref.name, ref.url);
    });

    // Populate bundle link definitions
    var blds = template.bundleLinkDefinitions || [];
    blds.forEach(function (bld) {
      addBundleLinkRow(bldContainer, bld.name);
    });

    // Populate task definitions
    var tds = template.taskDefinitions || [];
    tds.forEach(function (td) {
      addTaskDefItem(tdContainer, td, users);
    });

    // Setup drag-and-drop for task definitions
    setupTaskDefDragDrop(tdContainer);

    // Save handler
    document.getElementById('tpl-save-btn').addEventListener('click', function () {
      saveTemplate(template.id);
    });
  }

  function addReferenceRow(container, name, url) {
    var row = document.createElement('div');
    row.className = 'list-item-row ref-row';
    row.innerHTML =
      '<input type="text" class="ref-name" placeholder="Name" value="' + escapeHtml(name) + '" style="width:150px;" />' +
      '<input type="url" class="ref-url" placeholder="https://..." value="' + escapeHtml(url) + '" style="width:300px;" />';

    var removeBtn = document.createElement('button');
    removeBtn.className = 'btn-remove';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', function () {
      row.remove();
    });
    row.appendChild(removeBtn);
    container.appendChild(row);
  }

  function addBundleLinkRow(container, name) {
    var row = document.createElement('div');
    row.className = 'list-item-row bld-row';
    row.innerHTML =
      '<input type="text" class="bld-name" placeholder="Link name" value="' + escapeHtml(name) + '" style="width:200px;" />';

    var removeBtn = document.createElement('button');
    removeBtn.className = 'btn-remove';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', function () {
      row.remove();
    });
    row.appendChild(removeBtn);
    container.appendChild(row);
  }

  function addTaskDefItem(container, td, users) {
    var item = document.createElement('div');
    item.className = 'task-def-item';
    item.setAttribute('draggable', 'true');

    var header = document.createElement('div');
    header.className = 'task-def-header';

    var dragHandle = document.createElement('span');
    dragHandle.className = 'task-def-drag-handle';
    dragHandle.textContent = '\u2630';
    dragHandle.title = 'Drag to reorder';
    header.appendChild(dragHandle);

    var refIdSpan = document.createElement('span');
    refIdSpan.style.cssText = 'font-size:12px;color:#999;';
    refIdSpan.textContent = 'refId: ' + escapeHtml(td.refId || '');
    refIdSpan.className = 'td-refid-display';
    header.appendChild(refIdSpan);

    var removeBtn = document.createElement('button');
    removeBtn.className = 'btn-remove';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', function () {
      item.remove();
    });
    header.appendChild(removeBtn);

    item.appendChild(header);

    // Hidden refId field
    var refIdInput = document.createElement('input');
    refIdInput.type = 'hidden';
    refIdInput.className = 'td-refid';
    refIdInput.value = td.refId || '';
    item.appendChild(refIdInput);

    // Fields row
    var fieldsDiv = document.createElement('div');
    fieldsDiv.className = 'task-def-fields';

    // Description
    fieldsDiv.innerHTML =
      '<div class="editor-group">' +
        '<label>Description</label>' +
        '<input type="text" class="td-description" value="' + escapeHtml(td.description || '') + '" style="width:250px;" />' +
      '</div>' +
      '<div class="editor-group">' +
        '<label>Offset Days</label>' +
        '<input type="number" class="td-offset" value="' + (td.offsetDays != null ? td.offsetDays : 0) + '" style="width:80px;" />' +
      '</div>';

    // Assignee dropdown
    var assigneeGroup = document.createElement('div');
    assigneeGroup.className = 'editor-group';
    assigneeGroup.innerHTML = '<label>Assignee</label>';
    var assigneeSelect = document.createElement('select');
    assigneeSelect.className = 'td-assignee';
    assigneeSelect.innerHTML = '<option value="">(default)</option>';
    users.forEach(function (u) {
      var opt = document.createElement('option');
      opt.value = u.id;
      opt.textContent = u.name;
      if (td.assigneeId === u.id) opt.selected = true;
      assigneeSelect.appendChild(opt);
    });
    assigneeGroup.appendChild(assigneeSelect);
    fieldsDiv.appendChild(assigneeGroup);

    // Instructions URL
    var instrGroup = document.createElement('div');
    instrGroup.className = 'editor-group';
    instrGroup.innerHTML =
      '<label>Instructions URL</label>' +
      '<input type="text" class="td-instructions" value="' + escapeHtml(td.instructionsUrl || '') + '" style="width:250px;" />';
    fieldsDiv.appendChild(instrGroup);

    // Required link name
    var rlnGroup = document.createElement('div');
    rlnGroup.className = 'editor-group';
    rlnGroup.innerHTML =
      '<label>Required Link Name</label>' +
      '<input type="text" class="td-required-link" value="' + escapeHtml(td.requiredLinkName || '') + '" style="width:150px;" />';
    fieldsDiv.appendChild(rlnGroup);

    item.appendChild(fieldsDiv);

    // Checkboxes row
    var checkboxDiv = document.createElement('div');
    checkboxDiv.style.cssText = 'display:flex;gap:16px;margin-top:8px;flex-wrap:wrap;align-items:center;';

    // Is milestone
    var milestoneLabel = document.createElement('label');
    milestoneLabel.className = 'task-def-checkbox';
    var milestoneCheck = document.createElement('input');
    milestoneCheck.type = 'checkbox';
    milestoneCheck.className = 'td-milestone';
    if (td.isMilestone) milestoneCheck.checked = true;
    milestoneLabel.appendChild(milestoneCheck);
    milestoneLabel.appendChild(document.createTextNode(' Is Milestone'));
    checkboxDiv.appendChild(milestoneLabel);

    // Stage on complete (only visible if milestone)
    var stageGroup = document.createElement('div');
    stageGroup.className = 'editor-group td-stage-group';
    stageGroup.style.display = td.isMilestone ? '' : 'none';
    stageGroup.innerHTML = '<label>Stage on Complete</label>';
    var stageSelect = document.createElement('select');
    stageSelect.className = 'td-stage';
    var stageOptions = ['', 'announced', 'after-event', 'done'];
    stageOptions.forEach(function (s) {
      var opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s || '(none)';
      if (td.stageOnComplete === s) opt.selected = true;
      stageSelect.appendChild(opt);
    });
    stageGroup.appendChild(stageSelect);
    checkboxDiv.appendChild(stageGroup);

    // Toggle stage visibility on milestone change
    milestoneCheck.addEventListener('change', function () {
      stageGroup.style.display = milestoneCheck.checked ? '' : 'none';
    });

    // Requires file
    var fileLabel = document.createElement('label');
    fileLabel.className = 'task-def-checkbox';
    var fileCheck = document.createElement('input');
    fileCheck.type = 'checkbox';
    fileCheck.className = 'td-requires-file';
    if (td.requiresFile) fileCheck.checked = true;
    fileLabel.appendChild(fileCheck);
    fileLabel.appendChild(document.createTextNode(' Requires File'));
    checkboxDiv.appendChild(fileLabel);

    item.appendChild(checkboxDiv);
    container.appendChild(item);
  }

  function setupTaskDefDragDrop(container) {
    var dragSrc = null;

    container.addEventListener('dragstart', function (e) {
      var item = e.target.closest('.task-def-item');
      if (!item) return;
      dragSrc = item;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', '');
    });

    container.addEventListener('dragover', function (e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      var item = e.target.closest('.task-def-item');
      if (!item || item === dragSrc) return;

      // Remove drag-over from all items
      container.querySelectorAll('.task-def-item').forEach(function (el) {
        el.classList.remove('drag-over');
      });
      item.classList.add('drag-over');
    });

    container.addEventListener('drop', function (e) {
      e.preventDefault();
      var item = e.target.closest('.task-def-item');
      if (!item || !dragSrc || item === dragSrc) return;

      // Determine position
      var items = Array.from(container.querySelectorAll('.task-def-item'));
      var dragIdx = items.indexOf(dragSrc);
      var dropIdx = items.indexOf(item);

      if (dragIdx < dropIdx) {
        container.insertBefore(dragSrc, item.nextSibling);
      } else {
        container.insertBefore(dragSrc, item);
      }
    });

    container.addEventListener('dragend', function () {
      container.querySelectorAll('.task-def-item').forEach(function (el) {
        el.classList.remove('dragging');
        el.classList.remove('drag-over');
      });
      dragSrc = null;
    });
  }

  function saveTemplate(templateId) {
    var feedback = document.getElementById('tpl-save-feedback');
    feedback.textContent = 'Saving...';
    feedback.className = 'save-feedback';

    var name = document.getElementById('tpl-name').value.trim();
    var type = document.getElementById('tpl-type').value.trim();
    var emoji = document.getElementById('tpl-emoji').value.trim();
    var tagsStr = document.getElementById('tpl-tags').value.trim();
    var assigneeId = document.getElementById('tpl-assignee').value;

    var tags = tagsStr ? tagsStr.split(',').map(function (s) { return s.trim(); }).filter(function (s) { return s; }) : [];

    // Trigger config
    var triggerRadio = document.querySelector('input[name="tpl-trigger"]:checked');
    var triggerType = triggerRadio ? triggerRadio.value : 'manual';
    var triggerSchedule = document.getElementById('tpl-cron').value.trim();
    var triggerLeadDaysStr = document.getElementById('tpl-lead-days').value.trim();
    var triggerLeadDays = triggerLeadDaysStr ? parseInt(triggerLeadDaysStr, 10) : undefined;

    // References
    var references = [];
    document.querySelectorAll('#tpl-references-list .ref-row').forEach(function (row) {
      var refName = row.querySelector('.ref-name').value.trim();
      var refUrl = row.querySelector('.ref-url').value.trim();
      if (refName || refUrl) {
        references.push({ name: refName, url: refUrl });
      }
    });

    // Bundle link definitions
    var bundleLinkDefinitions = [];
    document.querySelectorAll('#tpl-bundlelinks-list .bld-row').forEach(function (row) {
      var bldName = row.querySelector('.bld-name').value.trim();
      if (bldName) {
        bundleLinkDefinitions.push({ name: bldName });
      }
    });

    // Task definitions
    var taskDefinitions = [];
    document.querySelectorAll('#tpl-taskdefs-list .task-def-item').forEach(function (item) {
      var refId = item.querySelector('.td-refid').value.trim();
      var description = item.querySelector('.td-description').value.trim();
      var offsetDays = parseInt(item.querySelector('.td-offset').value, 10) || 0;
      var isMilestone = item.querySelector('.td-milestone').checked;
      var stageOnComplete = item.querySelector('.td-stage').value || undefined;
      var tdAssigneeId = item.querySelector('.td-assignee').value || undefined;
      var instructionsUrl = item.querySelector('.td-instructions').value.trim() || undefined;
      var requiredLinkName = item.querySelector('.td-required-link').value.trim() || undefined;
      var requiresFile = item.querySelector('.td-requires-file').checked;

      var tdObj = {
        refId: refId,
        description: description,
        offsetDays: offsetDays
      };

      if (isMilestone) tdObj.isMilestone = true;
      if (stageOnComplete && isMilestone) tdObj.stageOnComplete = stageOnComplete;
      if (tdAssigneeId) tdObj.assigneeId = tdAssigneeId;
      if (instructionsUrl) tdObj.instructionsUrl = instructionsUrl;
      if (requiredLinkName) tdObj.requiredLinkName = requiredLinkName;
      if (requiresFile) tdObj.requiresFile = true;

      taskDefinitions.push(tdObj);
    });

    var updateData = {
      name: name,
      type: type,
      emoji: emoji || undefined,
      tags: tags.length > 0 ? tags : undefined,
      defaultAssigneeId: assigneeId || undefined,
      triggerType: triggerType,
      references: references.length > 0 ? references : undefined,
      bundleLinkDefinitions: bundleLinkDefinitions.length > 0 ? bundleLinkDefinitions : undefined,
      taskDefinitions: taskDefinitions
    };

    if (triggerType === 'automatic') {
      if (triggerSchedule) updateData.triggerSchedule = triggerSchedule;
      if (triggerLeadDays !== undefined && !isNaN(triggerLeadDays)) updateData.triggerLeadDays = triggerLeadDays;
    }

    api.templates.update(templateId, updateData).then(function () {
      feedback.textContent = 'Saved successfully!';
      feedback.className = 'save-feedback success';
    }).catch(function (err) {
      feedback.textContent = 'Save failed: ' + err.message;
      feedback.className = 'save-feedback error';
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
