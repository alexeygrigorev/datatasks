const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');

const { handler } = require('../src/handler');
const { startLocal, stopLocal, getClient } = require('../src/db/client');
const { createTables, deleteTables } = require('../src/db/setup');
const { createProject } = require('../src/db/projects');
const { createTemplate } = require('../src/db/templates');
const { createTask } = require('../src/db/tasks');

/**
 * Helper to invoke the Lambda handler with a simulated API Gateway event.
 */
function invoke(method, path, body) {
  const event = {
    httpMethod: method,
    path,
    body: body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : null,
  };
  return handler(event, {});
}

describe('API — Projects', () => {
  let client;

  before(async () => {
    const port = await startLocal();
    client = await getClient(port);
    await createTables(client);
  });

  after(async () => {
    await stopLocal();
  });

  // ---- Existing routes still work ----

  describe('Existing routes still work', () => {
    it('GET / returns 200 with HTML', async () => {
      const res = await invoke('GET', '/');
      assert.strictEqual(res.statusCode, 200);
      assert.ok(res.headers['Content-Type'].includes('text/html'));
    });

    it('GET /api/health returns 200 with ok status', async () => {
      const res = await invoke('GET', '/api/health');
      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.deepStrictEqual(body, { status: 'ok' });
    });
  });

  // ---- POST /api/projects ----

  describe('POST /api/projects', () => {
    it('creates a project with valid title and anchorDate', async () => {
      const res = await invoke('POST', '/api/projects', {
        title: 'ML Zoomcamp 2026',
        anchorDate: '2026-06-01',
      });

      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.headers['Content-Type'], 'application/json');

      const body = JSON.parse(res.body);
      assert.ok(body.project);
      assert.ok(body.project.id);
      assert.strictEqual(body.project.title, 'ML Zoomcamp 2026');
      assert.strictEqual(body.project.anchorDate, '2026-06-01');
      assert.ok(body.project.createdAt);
      assert.ok(body.project.updatedAt);
      // No tasks key when no template
      assert.strictEqual(body.tasks, undefined);
    });

    it('creates a project with optional description', async () => {
      const res = await invoke('POST', '/api/projects', {
        title: 'Newsletter',
        anchorDate: '2026-03-01',
        description: 'Weekly newsletter',
      });

      assert.strictEqual(res.statusCode, 201);
      const body = JSON.parse(res.body);
      assert.strictEqual(body.project.description, 'Weekly newsletter');
    });

    it('creates a project with a template and instantiates tasks', async () => {
      // Create a template first
      const template = await createTemplate(client, {
        name: 'Event Template',
        taskDefinitions: [
          { refId: 'prep', description: 'Prepare materials', offsetDays: -7 },
          { refId: 'event', description: 'Run event', offsetDays: 0 },
          { refId: 'followup', description: 'Follow up', offsetDays: 3 },
        ],
      });

      const res = await invoke('POST', '/api/projects', {
        title: 'Community Meetup',
        anchorDate: '2026-04-15',
        templateId: template.id,
      });

      assert.strictEqual(res.statusCode, 201);
      const body = JSON.parse(res.body);

      assert.ok(body.project);
      assert.strictEqual(body.project.templateId, template.id);

      assert.ok(body.tasks);
      assert.strictEqual(body.tasks.length, 3);

      // Check task dates based on anchor + offset
      const dates = body.tasks.map((t) => t.date).sort();
      assert.deepStrictEqual(dates, ['2026-04-08', '2026-04-15', '2026-04-18']);

      // All tasks have the correct projectId
      for (const task of body.tasks) {
        assert.strictEqual(task.projectId, body.project.id);
        assert.strictEqual(task.source, 'template');
      }
    });

    it('returns 404 when templateId does not exist', async () => {
      const res = await invoke('POST', '/api/projects', {
        title: 'Test',
        anchorDate: '2026-01-01',
        templateId: 'nonexistent-id',
      });

      assert.strictEqual(res.statusCode, 404);
      const body = JSON.parse(res.body);
      assert.strictEqual(body.error, 'Template not found');
    });

    it('returns 400 when title is missing', async () => {
      const res = await invoke('POST', '/api/projects', {
        anchorDate: '2026-06-01',
      });

      assert.strictEqual(res.statusCode, 400);
      const body = JSON.parse(res.body);
      assert.ok(body.error.toLowerCase().includes('title'));
    });

    it('returns 400 when title is empty string', async () => {
      const res = await invoke('POST', '/api/projects', {
        title: '  ',
        anchorDate: '2026-06-01',
      });

      assert.strictEqual(res.statusCode, 400);
      const body = JSON.parse(res.body);
      assert.ok(body.error.toLowerCase().includes('title'));
    });

    it('returns 400 when anchorDate is missing', async () => {
      const res = await invoke('POST', '/api/projects', {
        title: 'Test',
      });

      assert.strictEqual(res.statusCode, 400);
      const body = JSON.parse(res.body);
      assert.ok(body.error.toLowerCase().includes('anchordate'));
    });

    it('returns 400 for malformed JSON body', async () => {
      const res = await invoke('POST', '/api/projects', 'not valid json{{');

      assert.strictEqual(res.statusCode, 400);
      const body = JSON.parse(res.body);
      assert.strictEqual(body.error, 'Invalid JSON');
    });
  });

  // ---- GET /api/projects ----

  describe('GET /api/projects', () => {
    it('returns 200 with an array of projects', async () => {
      const res = await invoke('GET', '/api/projects');

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.headers['Content-Type'], 'application/json');

      const body = JSON.parse(res.body);
      assert.ok(Array.isArray(body.projects));
      assert.ok(body.projects.length > 0);
    });
  });

  // ---- GET /api/projects/:id ----

  describe('GET /api/projects/:id', () => {
    it('returns 200 with the project for a valid id', async () => {
      const created = await createProject(client, {
        title: 'My Project',
        anchorDate: '2026-01-01',
      });

      const res = await invoke('GET', `/api/projects/${created.id}`);
      assert.strictEqual(res.statusCode, 200);

      const body = JSON.parse(res.body);
      assert.ok(body.project);
      assert.strictEqual(body.project.id, created.id);
      assert.strictEqual(body.project.title, 'My Project');
    });

    it('returns 404 for a non-existent project', async () => {
      const res = await invoke('GET', '/api/projects/does-not-exist');

      assert.strictEqual(res.statusCode, 404);
      const body = JSON.parse(res.body);
      assert.strictEqual(body.error, 'Project not found');
    });
  });

  // ---- PUT /api/projects/:id ----

  describe('PUT /api/projects/:id', () => {
    it('updates a project and returns 200', async () => {
      const created = await createProject(client, {
        title: 'Old Title',
        anchorDate: '2026-01-01',
      });

      // Small delay to ensure updatedAt will differ
      await new Promise((r) => setTimeout(r, 10));

      const res = await invoke('PUT', `/api/projects/${created.id}`, {
        title: 'New Title',
      });

      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.strictEqual(body.project.title, 'New Title');
      assert.ok(body.project.updatedAt > created.updatedAt);
    });

    it('returns 404 when updating a non-existent project', async () => {
      const res = await invoke('PUT', '/api/projects/does-not-exist', {
        title: 'New',
      });

      assert.strictEqual(res.statusCode, 404);
      const body = JSON.parse(res.body);
      assert.strictEqual(body.error, 'Project not found');
    });

    it('returns 400 when body is empty', async () => {
      const created = await createProject(client, {
        title: 'Test',
        anchorDate: '2026-01-01',
      });

      const res = await invoke('PUT', `/api/projects/${created.id}`, {});

      assert.strictEqual(res.statusCode, 400);
    });

    it('returns 400 for malformed JSON', async () => {
      const created = await createProject(client, {
        title: 'Test',
        anchorDate: '2026-01-01',
      });

      const res = await invoke('PUT', `/api/projects/${created.id}`, 'bad json');
      assert.strictEqual(res.statusCode, 400);
    });
  });

  // ---- DELETE /api/projects/:id ----

  describe('DELETE /api/projects/:id', () => {
    it('deletes an existing project and returns 204', async () => {
      const created = await createProject(client, {
        title: 'Delete me',
        anchorDate: '2026-01-01',
      });

      const res = await invoke('DELETE', `/api/projects/${created.id}`);
      assert.strictEqual(res.statusCode, 204);

      // Verify it's actually gone
      const getRes = await invoke('GET', `/api/projects/${created.id}`);
      assert.strictEqual(getRes.statusCode, 404);
    });

    it('returns 404 when deleting a non-existent project', async () => {
      const res = await invoke('DELETE', '/api/projects/does-not-exist');
      assert.strictEqual(res.statusCode, 404);
    });
  });

  // ---- GET /api/projects/:id/tasks ----

  describe('GET /api/projects/:id/tasks', () => {
    it('returns tasks for a project', async () => {
      const project = await createProject(client, {
        title: 'Task List Project',
        anchorDate: '2026-01-01',
      });

      // Create some tasks for this project
      await createTask(client, {
        description: 'Task 1',
        projectId: project.id,
        date: '2026-01-01',
        status: 'todo',
      });
      await createTask(client, {
        description: 'Task 2',
        projectId: project.id,
        date: '2026-01-02',
        status: 'todo',
      });

      const res = await invoke('GET', `/api/projects/${project.id}/tasks`);
      assert.strictEqual(res.statusCode, 200);

      const body = JSON.parse(res.body);
      assert.ok(Array.isArray(body.tasks));
      assert.strictEqual(body.tasks.length, 2);
      for (const task of body.tasks) {
        assert.strictEqual(task.projectId, project.id);
      }
    });

    it('returns empty tasks array for project with no tasks', async () => {
      const project = await createProject(client, {
        title: 'No Tasks Project',
        anchorDate: '2026-01-01',
      });

      const res = await invoke('GET', `/api/projects/${project.id}/tasks`);
      assert.strictEqual(res.statusCode, 200);

      const body = JSON.parse(res.body);
      assert.ok(Array.isArray(body.tasks));
      assert.strictEqual(body.tasks.length, 0);
    });

    it('returns 404 for tasks of a non-existent project', async () => {
      const res = await invoke('GET', '/api/projects/does-not-exist/tasks');
      assert.strictEqual(res.statusCode, 404);
    });
  });

  // ---- Method not allowed ----

  describe('Method not allowed', () => {
    it('returns 405 for PATCH /api/projects', async () => {
      const res = await invoke('PATCH', '/api/projects');
      assert.strictEqual(res.statusCode, 405);
      const body = JSON.parse(res.body);
      assert.strictEqual(body.error, 'Method not allowed');
    });

    it('returns 405 for POST /api/projects/:id', async () => {
      const project = await createProject(client, {
        title: 'Test',
        anchorDate: '2026-01-01',
      });
      const res = await invoke('POST', `/api/projects/${project.id}`);
      assert.strictEqual(res.statusCode, 405);
    });

    it('returns 405 for PATCH /api/projects/:id', async () => {
      const project = await createProject(client, {
        title: 'Test',
        anchorDate: '2026-01-01',
      });
      const res = await invoke('PATCH', `/api/projects/${project.id}`);
      assert.strictEqual(res.statusCode, 405);
    });

    it('returns 405 for POST /api/projects/:id/tasks', async () => {
      const project = await createProject(client, {
        title: 'Test',
        anchorDate: '2026-01-01',
      });
      const res = await invoke('POST', `/api/projects/${project.id}/tasks`);
      assert.strictEqual(res.statusCode, 405);
    });
  });

  // ---- Content-Type header ----

  describe('Content-Type header', () => {
    it('all API responses include Content-Type: application/json', async () => {
      const res200 = await invoke('GET', '/api/projects');
      assert.strictEqual(res200.headers['Content-Type'], 'application/json');

      const res404 = await invoke('GET', '/api/projects/nonexistent');
      assert.strictEqual(res404.headers['Content-Type'], 'application/json');

      const res201 = await invoke('POST', '/api/projects', {
        title: 'CT Test',
        anchorDate: '2026-01-01',
      });
      assert.strictEqual(res201.headers['Content-Type'], 'application/json');

      const res405 = await invoke('PATCH', '/api/projects');
      assert.strictEqual(res405.headers['Content-Type'], 'application/json');
    });
  });
});
