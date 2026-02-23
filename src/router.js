const fs = require('fs');
const path = require('path');

const { handleProjectRoutes } = require('./routes/projects');
const { handleTemplateRoutes } = require('./routes/templates');
const { handleRecurringRoutes } = require('./routes/recurring');
const {
  createTask,
  getTask,
  updateTask,
  deleteTask,
  listTasksByDate,
  listTasksByDateRange,
  listTasksByProject,
  listTasksByStatus,
} = require('./db/tasks');

const JSON_HEADERS = { 'Content-Type': 'application/json' };

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: JSON_HEADERS,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  };
}

function parseBody(event) {
  if (!event.body) return null;
  if (typeof event.body === 'object') return event.body;
  try {
    return JSON.parse(event.body);
  } catch {
    return null;
  }
}

function extractTaskId(reqPath) {
  const prefix = '/api/tasks/';
  if (reqPath.startsWith(prefix) && reqPath.length > prefix.length) {
    return reqPath.slice(prefix.length);
  }
  return null;
}

const ALLOWED_UPDATE_FIELDS = ['description', 'date', 'comment', 'status', 'projectId', 'source'];

async function route(event, client) {
  const method = event.httpMethod || 'GET';
  const reqPath = event.path || '/';

  try {
    // GET / — serve SPA HTML
    if (method === 'GET' && reqPath === '/') {
      const htmlPath = path.join(__dirname, 'pages', 'index.html');
      const html = fs.readFileSync(htmlPath, 'utf-8');
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/html' },
        body: html,
      };
    }

    // GET /public/*.js — serve static JS files
    if (method === 'GET' && reqPath.startsWith('/public/')) {
      // Guard against path traversal
      if (reqPath.includes('..')) {
        return jsonResponse(404, { error: 'Not found' });
      }

      // Only serve .js files
      if (!reqPath.endsWith('.js')) {
        return jsonResponse(404, { error: 'Not found' });
      }

      const filename = reqPath.slice('/public/'.length);

      // Extra safety: reject if filename contains slashes (only serve from top-level public dir)
      if (filename.includes('/') || filename.includes('\\')) {
        return jsonResponse(404, { error: 'Not found' });
      }

      const filePath = path.join(__dirname, 'public', filename);

      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/javascript' },
          body: content,
        };
      } catch {
        return jsonResponse(404, { error: 'Not found' });
      }
    }

    // GET /api/health — health check
    if (method === 'GET' && reqPath === '/api/health') {
      return jsonResponse(200, { status: 'ok' });
    }

    // ── Task routes ────────────────────────────────────────────────

    // POST /api/tasks — Create a task
    if (method === 'POST' && reqPath === '/api/tasks') {
      const body = parseBody(event);
      if (!body) {
        return jsonResponse(400, { error: 'Request body is required' });
      }
      if (!body.description) {
        return jsonResponse(400, { error: 'Missing required field: description' });
      }
      if (!body.date) {
        return jsonResponse(400, { error: 'Missing required field: date' });
      }

      const taskData = {};
      if (body.description) taskData.description = body.description;
      if (body.date) taskData.date = body.date;
      if (body.comment !== undefined) taskData.comment = body.comment;
      if (body.projectId !== undefined) taskData.projectId = body.projectId;
      taskData.source = body.source || 'manual';

      const task = await createTask(client, taskData);
      return jsonResponse(201, task);
    }

    // GET /api/tasks — List tasks with filters
    if (method === 'GET' && reqPath === '/api/tasks') {
      const params = event.queryStringParameters || {};
      const { date, startDate, endDate, projectId, status } = params;

      if (!date && !startDate && !endDate && !projectId && !status) {
        return jsonResponse(400, {
          error: 'At least one filter is required: date, startDate+endDate, projectId, or status',
        });
      }

      // Priority: date > startDate+endDate > projectId > status
      if (date) {
        const tasks = await listTasksByDate(client, date);
        return jsonResponse(200, { tasks });
      }

      if (startDate || endDate) {
        if (!startDate || !endDate) {
          return jsonResponse(400, {
            error: 'Both startDate and endDate are required for range queries',
          });
        }
        const tasks = await listTasksByDateRange(client, startDate, endDate);
        return jsonResponse(200, { tasks });
      }

      if (projectId) {
        const tasks = await listTasksByProject(client, projectId);
        return jsonResponse(200, { tasks });
      }

      if (status) {
        if (status !== 'todo' && status !== 'done') {
          return jsonResponse(400, {
            error: "Invalid status. Must be 'todo' or 'done'",
          });
        }
        const tasks = await listTasksByStatus(client, status);
        return jsonResponse(200, { tasks });
      }
    }

    // GET /api/tasks/:id — Get a single task
    if (method === 'GET' && reqPath.startsWith('/api/tasks/')) {
      const id = extractTaskId(reqPath);
      if (!id) {
        return jsonResponse(404, { error: 'Not found' });
      }
      const task = await getTask(client, id);
      if (!task) {
        return jsonResponse(404, { error: 'Task not found' });
      }
      return jsonResponse(200, task);
    }

    // PUT /api/tasks/:id — Update a task
    if (method === 'PUT' && reqPath.startsWith('/api/tasks/')) {
      const id = extractTaskId(reqPath);
      if (!id) {
        return jsonResponse(404, { error: 'Not found' });
      }

      const body = parseBody(event);
      if (!body) {
        return jsonResponse(400, { error: 'Request body is required' });
      }

      // Filter to allowed fields only
      const updates = {};
      for (const field of ALLOWED_UPDATE_FIELDS) {
        if (body[field] !== undefined) {
          updates[field] = body[field];
        }
      }

      if (Object.keys(updates).length === 0) {
        return jsonResponse(400, { error: 'No valid fields to update' });
      }

      // Verify task exists
      const existing = await getTask(client, id);
      if (!existing) {
        return jsonResponse(404, { error: 'Task not found' });
      }

      const updated = await updateTask(client, id, updates);
      return jsonResponse(200, updated);
    }

    // DELETE /api/tasks/:id — Delete a task
    if (method === 'DELETE' && reqPath.startsWith('/api/tasks/')) {
      const id = extractTaskId(reqPath);
      if (!id) {
        return jsonResponse(404, { error: 'Not found' });
      }
      await deleteTask(client, id);
      return {
        statusCode: 204,
        headers: JSON_HEADERS,
        body: '',
      };
    }

    // ── Project routes ─────────────────────────────────────────────

    if (reqPath.startsWith('/api/projects')) {
      const result = await handleProjectRoutes(reqPath, method, event.body);
      if (result) return result;
    }

    // ── Template routes ────────────────────────────────────────────

    if (reqPath.startsWith('/api/templates')) {
      const result = await handleTemplateRoutes(reqPath, method, event.body);
      if (result) return result;
    }

    // ── Recurring routes ───────────────────────────────────────────

    if (reqPath.startsWith('/api/recurring')) {
      const result = await handleRecurringRoutes(reqPath, method, event.body);
      if (result) return result;
    }

    // Anything else — 404
    return jsonResponse(404, { error: 'Not found' });
  } catch (err) {
    console.error('Unexpected error:', err);
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

module.exports = { route };
