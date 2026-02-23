const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');

const { handler } = require('../src/handler');
const { startLocal, stopLocal, getClient } = require('../src/db/client');
const { createTables } = require('../src/db/setup');
const { createTemplate } = require('../src/db/templates');

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

describe('API — Templates', () => {
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

    it('GET /api/projects returns 200', async () => {
      const res = await invoke('GET', '/api/projects');
      assert.strictEqual(res.statusCode, 200);
    });

    it('GET /api/tasks?status=todo returns 200', async () => {
      const event = {
        httpMethod: 'GET',
        path: '/api/tasks',
        body: null,
        queryStringParameters: { status: 'todo' },
      };
      const res = await handler(event, {});
      assert.strictEqual(res.statusCode, 200);
    });
  });

  // ---- POST /api/templates ----

  describe('POST /api/templates', () => {
    it('creates a template with valid name, type, and taskDefinitions', async () => {
      const res = await invoke('POST', '/api/templates', {
        name: 'Newsletter',
        type: 'newsletter',
        taskDefinitions: [
          { refId: 'draft', description: 'Write draft', offsetDays: -7 },
          { refId: 'send', description: 'Send newsletter', offsetDays: 0 },
        ],
      });

      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.headers['Content-Type'], 'application/json');

      const body = JSON.parse(res.body);
      assert.ok(body.template);
      assert.ok(body.template.id);
      assert.strictEqual(body.template.name, 'Newsletter');
      assert.strictEqual(body.template.type, 'newsletter');
      assert.ok(Array.isArray(body.template.taskDefinitions));
      assert.strictEqual(body.template.taskDefinitions.length, 2);
      assert.ok(body.template.createdAt);
      assert.ok(body.template.updatedAt);
    });

    it('returns 400 when name is missing', async () => {
      const res = await invoke('POST', '/api/templates', {
        type: 'newsletter',
        taskDefinitions: [
          { refId: 'draft', description: 'Write draft', offsetDays: -7 },
        ],
      });

      assert.strictEqual(res.statusCode, 400);
      const body = JSON.parse(res.body);
      assert.ok(body.error.toLowerCase().includes('name'));
    });

    it('returns 400 when name is empty string', async () => {
      const res = await invoke('POST', '/api/templates', {
        name: '  ',
        type: 'newsletter',
        taskDefinitions: [
          { refId: 'draft', description: 'Write draft', offsetDays: -7 },
        ],
      });

      assert.strictEqual(res.statusCode, 400);
      const body = JSON.parse(res.body);
      assert.ok(body.error.toLowerCase().includes('name'));
    });

    it('returns 400 when type is missing', async () => {
      const res = await invoke('POST', '/api/templates', {
        name: 'Newsletter',
        taskDefinitions: [
          { refId: 'draft', description: 'Write draft', offsetDays: -7 },
        ],
      });

      assert.strictEqual(res.statusCode, 400);
      const body = JSON.parse(res.body);
      assert.ok(body.error.toLowerCase().includes('type'));
    });

    it('returns 400 when type is empty string', async () => {
      const res = await invoke('POST', '/api/templates', {
        name: 'Newsletter',
        type: '',
        taskDefinitions: [
          { refId: 'draft', description: 'Write draft', offsetDays: -7 },
        ],
      });

      assert.strictEqual(res.statusCode, 400);
      const body = JSON.parse(res.body);
      assert.ok(body.error.toLowerCase().includes('type'));
    });

    it('returns 400 when taskDefinitions is missing', async () => {
      const res = await invoke('POST', '/api/templates', {
        name: 'Newsletter',
        type: 'newsletter',
      });

      assert.strictEqual(res.statusCode, 400);
      const body = JSON.parse(res.body);
      assert.ok(body.error.toLowerCase().includes('taskdefinitions'));
    });

    it('returns 400 when taskDefinitions is empty array', async () => {
      const res = await invoke('POST', '/api/templates', {
        name: 'Newsletter',
        type: 'newsletter',
        taskDefinitions: [],
      });

      assert.strictEqual(res.statusCode, 400);
      const body = JSON.parse(res.body);
      assert.ok(body.error.toLowerCase().includes('taskdefinitions'));
    });

    it('returns 400 when taskDefinitions is not an array', async () => {
      const res = await invoke('POST', '/api/templates', {
        name: 'Newsletter',
        type: 'newsletter',
        taskDefinitions: 'not-an-array',
      });

      assert.strictEqual(res.statusCode, 400);
      const body = JSON.parse(res.body);
      assert.ok(body.error.toLowerCase().includes('taskdefinitions'));
    });

    it('returns 400 when taskDefinition is missing refId', async () => {
      const res = await invoke('POST', '/api/templates', {
        name: 'Test',
        type: 'test',
        taskDefinitions: [
          { description: 'Task without refId', offsetDays: 0 },
        ],
      });

      assert.strictEqual(res.statusCode, 400);
      const body = JSON.parse(res.body);
      assert.ok(body.error.toLowerCase().includes('refid'));
    });

    it('returns 400 when taskDefinition is missing description', async () => {
      const res = await invoke('POST', '/api/templates', {
        name: 'Test',
        type: 'test',
        taskDefinitions: [
          { refId: 'task1', offsetDays: 0 },
        ],
      });

      assert.strictEqual(res.statusCode, 400);
      const body = JSON.parse(res.body);
      assert.ok(body.error.toLowerCase().includes('description'));
    });

    it('returns 400 when taskDefinition is missing offsetDays', async () => {
      const res = await invoke('POST', '/api/templates', {
        name: 'Test',
        type: 'test',
        taskDefinitions: [
          { refId: 'task1', description: 'Some task' },
        ],
      });

      assert.strictEqual(res.statusCode, 400);
      const body = JSON.parse(res.body);
      assert.ok(body.error.toLowerCase().includes('offsetdays'));
    });

    it('returns 400 for malformed JSON body', async () => {
      const res = await invoke('POST', '/api/templates', 'not valid json{{');

      assert.strictEqual(res.statusCode, 400);
      const body = JSON.parse(res.body);
      assert.strictEqual(body.error, 'Invalid JSON');
    });
  });

  // ---- GET /api/templates ----

  describe('GET /api/templates', () => {
    it('returns 200 with an array of templates', async () => {
      const res = await invoke('GET', '/api/templates');

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.headers['Content-Type'], 'application/json');

      const body = JSON.parse(res.body);
      assert.ok(Array.isArray(body.templates));
      assert.ok(body.templates.length > 0);
    });
  });

  // ---- GET /api/templates/:id ----

  describe('GET /api/templates/:id', () => {
    it('returns 200 with the template for a valid id', async () => {
      const created = await createTemplate(client, {
        name: 'My Template',
        type: 'test',
        taskDefinitions: [
          { refId: 'a', description: 'Task A', offsetDays: 0 },
        ],
      });

      const res = await invoke('GET', `/api/templates/${created.id}`);
      assert.strictEqual(res.statusCode, 200);

      const body = JSON.parse(res.body);
      assert.ok(body.template);
      assert.strictEqual(body.template.id, created.id);
      assert.strictEqual(body.template.name, 'My Template');
      assert.ok(Array.isArray(body.template.taskDefinitions));
    });

    it('returns 404 for a non-existent template', async () => {
      const res = await invoke('GET', '/api/templates/does-not-exist');

      assert.strictEqual(res.statusCode, 404);
      const body = JSON.parse(res.body);
      assert.strictEqual(body.error, 'Template not found');
    });
  });

  // ---- PUT /api/templates/:id ----

  describe('PUT /api/templates/:id', () => {
    it('updates a template name and returns 200', async () => {
      const created = await createTemplate(client, {
        name: 'Old Name',
        type: 'test',
        taskDefinitions: [
          { refId: 'a', description: 'Task A', offsetDays: 0 },
        ],
      });

      // Small delay to ensure updatedAt will differ
      await new Promise((r) => setTimeout(r, 10));

      const res = await invoke('PUT', `/api/templates/${created.id}`, {
        name: 'New Name',
      });

      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.strictEqual(body.template.name, 'New Name');
      assert.ok(body.template.updatedAt > created.updatedAt);
    });

    it('updates a template type and returns 200', async () => {
      const created = await createTemplate(client, {
        name: 'Template',
        type: 'old-type',
        taskDefinitions: [
          { refId: 'a', description: 'Task A', offsetDays: 0 },
        ],
      });

      const res = await invoke('PUT', `/api/templates/${created.id}`, {
        type: 'new-type',
      });

      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.strictEqual(body.template.type, 'new-type');
    });

    it('updates taskDefinitions and returns 200', async () => {
      const created = await createTemplate(client, {
        name: 'Template',
        type: 'test',
        taskDefinitions: [
          { refId: 'a', description: 'Task A', offsetDays: 0 },
          { refId: 'b', description: 'Task B', offsetDays: 1 },
        ],
      });

      const res = await invoke('PUT', `/api/templates/${created.id}`, {
        taskDefinitions: [
          { refId: 'x', description: 'Task X', offsetDays: -5 },
          { refId: 'y', description: 'Task Y', offsetDays: 0 },
          { refId: 'z', description: 'Task Z', offsetDays: 3 },
        ],
      });

      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.strictEqual(body.template.taskDefinitions.length, 3);
    });

    it('returns 400 when updating taskDefinitions with invalid data', async () => {
      const created = await createTemplate(client, {
        name: 'Template',
        type: 'test',
        taskDefinitions: [
          { refId: 'a', description: 'Task A', offsetDays: 0 },
        ],
      });

      const res = await invoke('PUT', `/api/templates/${created.id}`, {
        taskDefinitions: [{ refId: 'a' }],
      });

      assert.strictEqual(res.statusCode, 400);
      const body = JSON.parse(res.body);
      assert.ok(body.error.toLowerCase().includes('description'));
    });

    it('returns 404 when updating a non-existent template', async () => {
      const res = await invoke('PUT', '/api/templates/does-not-exist', {
        name: 'New',
      });

      assert.strictEqual(res.statusCode, 404);
      const body = JSON.parse(res.body);
      assert.strictEqual(body.error, 'Template not found');
    });

    it('returns 400 when body is empty', async () => {
      const created = await createTemplate(client, {
        name: 'Test',
        type: 'test',
        taskDefinitions: [
          { refId: 'a', description: 'Task A', offsetDays: 0 },
        ],
      });

      const res = await invoke('PUT', `/api/templates/${created.id}`, {});

      assert.strictEqual(res.statusCode, 400);
    });

    it('returns 400 when body has no valid fields', async () => {
      const created = await createTemplate(client, {
        name: 'Test',
        type: 'test',
        taskDefinitions: [
          { refId: 'a', description: 'Task A', offsetDays: 0 },
        ],
      });

      const res = await invoke('PUT', `/api/templates/${created.id}`, {
        unknownField: 'value',
      });

      assert.strictEqual(res.statusCode, 400);
      const body = JSON.parse(res.body);
      assert.ok(body.error.toLowerCase().includes('no valid fields'));
    });

    it('returns 400 for malformed JSON', async () => {
      const created = await createTemplate(client, {
        name: 'Test',
        type: 'test',
        taskDefinitions: [
          { refId: 'a', description: 'Task A', offsetDays: 0 },
        ],
      });

      const res = await invoke('PUT', `/api/templates/${created.id}`, 'bad json');
      assert.strictEqual(res.statusCode, 400);
    });
  });

  // ---- DELETE /api/templates/:id ----

  describe('DELETE /api/templates/:id', () => {
    it('deletes an existing template and returns 204', async () => {
      const created = await createTemplate(client, {
        name: 'Delete me',
        type: 'test',
        taskDefinitions: [
          { refId: 'a', description: 'Task A', offsetDays: 0 },
        ],
      });

      const res = await invoke('DELETE', `/api/templates/${created.id}`);
      assert.strictEqual(res.statusCode, 204);

      // Verify it's actually gone
      const getRes = await invoke('GET', `/api/templates/${created.id}`);
      assert.strictEqual(getRes.statusCode, 404);
    });

    it('returns 404 when deleting a non-existent template', async () => {
      const res = await invoke('DELETE', '/api/templates/does-not-exist');
      assert.strictEqual(res.statusCode, 404);
    });
  });

  // ---- Method not allowed ----

  describe('Method not allowed', () => {
    it('returns 405 for PATCH /api/templates', async () => {
      const res = await invoke('PATCH', '/api/templates');
      assert.strictEqual(res.statusCode, 405);
      const body = JSON.parse(res.body);
      assert.strictEqual(body.error, 'Method not allowed');
    });

    it('returns 405 for POST /api/templates/:id', async () => {
      const created = await createTemplate(client, {
        name: 'Test',
        type: 'test',
        taskDefinitions: [
          { refId: 'a', description: 'Task A', offsetDays: 0 },
        ],
      });
      const res = await invoke('POST', `/api/templates/${created.id}`);
      assert.strictEqual(res.statusCode, 405);
    });

    it('returns 405 for PATCH /api/templates/:id', async () => {
      const created = await createTemplate(client, {
        name: 'Test',
        type: 'test',
        taskDefinitions: [
          { refId: 'a', description: 'Task A', offsetDays: 0 },
        ],
      });
      const res = await invoke('PATCH', `/api/templates/${created.id}`);
      assert.strictEqual(res.statusCode, 405);
    });
  });

  // ---- Content-Type header ----

  describe('Content-Type header', () => {
    it('all API responses include Content-Type: application/json', async () => {
      const res200 = await invoke('GET', '/api/templates');
      assert.strictEqual(res200.headers['Content-Type'], 'application/json');

      const res404 = await invoke('GET', '/api/templates/nonexistent');
      assert.strictEqual(res404.headers['Content-Type'], 'application/json');

      const res201 = await invoke('POST', '/api/templates', {
        name: 'CT Test',
        type: 'test',
        taskDefinitions: [
          { refId: 'a', description: 'Task A', offsetDays: 0 },
        ],
      });
      assert.strictEqual(res201.headers['Content-Type'], 'application/json');

      const res405 = await invoke('PATCH', '/api/templates');
      assert.strictEqual(res405.headers['Content-Type'], 'application/json');
    });
  });
});
