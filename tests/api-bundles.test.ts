import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

import { handler } from '../src/handler';
import { startLocal, stopLocal, getClient } from '../src/db/client';
import { createTables, deleteTables } from '../src/db/setup';
import { createBundle } from '../src/db/bundles';
import { createTemplate } from '../src/db/templates';
import { createTask } from '../src/db/tasks';
import type { LambdaResponse } from '../src/types';

function invoke(method: string, path: string, body?: unknown): Promise<LambdaResponse> {
  const event = {
    httpMethod: method,
    path,
    body: body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : null,
  };
  return handler(event, {});
}

describe('API — Bundles', () => {
  let client: DynamoDBDocumentClient;

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
      assert.ok(res.headers!['Content-Type'].includes('text/html'));
    });

    it('GET /api/health returns 200 with ok status', async () => {
      const res = await invoke('GET', '/api/health');
      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.deepStrictEqual(body, { status: 'ok' });
    });
  });

  // ---- POST /api/bundles ----

  describe('POST /api/bundles', () => {
    it('creates a bundle with valid title and anchorDate', async () => {
      const res = await invoke('POST', '/api/bundles', {
        title: 'ML Zoomcamp 2026',
        anchorDate: '2026-06-01',
      });

      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.headers!['Content-Type'], 'application/json');

      const body = JSON.parse(res.body);
      assert.ok(body.bundle);
      assert.ok(body.bundle.id);
      assert.strictEqual(body.bundle.title, 'ML Zoomcamp 2026');
      assert.strictEqual(body.bundle.anchorDate, '2026-06-01');
      assert.ok(body.bundle.createdAt);
      assert.ok(body.bundle.updatedAt);
      assert.strictEqual(body.tasks, undefined);
    });

    it('creates a bundle with optional description', async () => {
      const res = await invoke('POST', '/api/bundles', {
        title: 'Newsletter',
        anchorDate: '2026-03-01',
        description: 'Weekly newsletter',
      });

      assert.strictEqual(res.statusCode, 201);
      const body = JSON.parse(res.body);
      assert.strictEqual(body.bundle.description, 'Weekly newsletter');
    });

    it('creates a bundle with a template and instantiates tasks', async () => {
      const template = await createTemplate(client, {
        name: 'Event Template',
        taskDefinitions: [
          { refId: 'prep', description: 'Prepare materials', offsetDays: -7 },
          { refId: 'event', description: 'Run event', offsetDays: 0 },
          { refId: 'followup', description: 'Follow up', offsetDays: 3 },
        ],
      });

      const res = await invoke('POST', '/api/bundles', {
        title: 'Community Meetup',
        anchorDate: '2026-04-15',
        templateId: template.id,
      });

      assert.strictEqual(res.statusCode, 201);
      const body = JSON.parse(res.body);

      assert.ok(body.bundle);
      assert.strictEqual(body.bundle.templateId, template.id);

      assert.ok(body.tasks);
      assert.strictEqual(body.tasks.length, 3);

      const dates = body.tasks.map((t: any) => t.date).sort();
      assert.deepStrictEqual(dates, ['2026-04-08', '2026-04-15', '2026-04-18']);

      for (const task of body.tasks) {
        assert.strictEqual(task.bundleId, body.bundle.id);
        assert.strictEqual(task.source, 'template');
      }
    });

    it('returns 404 when templateId does not exist', async () => {
      const res = await invoke('POST', '/api/bundles', {
        title: 'Test',
        anchorDate: '2026-01-01',
        templateId: 'nonexistent-id',
      });

      assert.strictEqual(res.statusCode, 404);
      const body = JSON.parse(res.body);
      assert.strictEqual(body.error, 'Template not found');
    });

    it('returns 400 when title is missing', async () => {
      const res = await invoke('POST', '/api/bundles', {
        anchorDate: '2026-06-01',
      });

      assert.strictEqual(res.statusCode, 400);
      const body = JSON.parse(res.body);
      assert.ok(body.error.toLowerCase().includes('title'));
    });

    it('returns 400 when title is empty string', async () => {
      const res = await invoke('POST', '/api/bundles', {
        title: '  ',
        anchorDate: '2026-06-01',
      });

      assert.strictEqual(res.statusCode, 400);
      const body = JSON.parse(res.body);
      assert.ok(body.error.toLowerCase().includes('title'));
    });

    it('returns 400 when anchorDate is missing', async () => {
      const res = await invoke('POST', '/api/bundles', {
        title: 'Test',
      });

      assert.strictEqual(res.statusCode, 400);
      const body = JSON.parse(res.body);
      assert.ok(body.error.toLowerCase().includes('anchordate'));
    });

    it('returns 400 for malformed JSON body', async () => {
      const res = await invoke('POST', '/api/bundles', 'not valid json{{');

      assert.strictEqual(res.statusCode, 400);
      const body = JSON.parse(res.body);
      assert.strictEqual(body.error, 'Invalid JSON');
    });
  });

  // ---- GET /api/bundles ----

  describe('GET /api/bundles', () => {
    it('returns 200 with an array of bundles', async () => {
      const res = await invoke('GET', '/api/bundles');

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.headers!['Content-Type'], 'application/json');

      const body = JSON.parse(res.body);
      assert.ok(Array.isArray(body.bundles));
      assert.ok(body.bundles.length > 0);
    });
  });

  // ---- GET /api/bundles/:id ----

  describe('GET /api/bundles/:id', () => {
    it('returns 200 with the bundle for a valid id', async () => {
      const created = await createBundle(client, {
        title: 'My Bundle',
        anchorDate: '2026-01-01',
      });

      const res = await invoke('GET', `/api/bundles/${created.id}`);
      assert.strictEqual(res.statusCode, 200);

      const body = JSON.parse(res.body);
      assert.ok(body.bundle);
      assert.strictEqual(body.bundle.id, created.id);
      assert.strictEqual(body.bundle.title, 'My Bundle');
    });

    it('returns 404 for a non-existent bundle', async () => {
      const res = await invoke('GET', '/api/bundles/does-not-exist');

      assert.strictEqual(res.statusCode, 404);
      const body = JSON.parse(res.body);
      assert.strictEqual(body.error, 'Bundle not found');
    });
  });

  // ---- PUT /api/bundles/:id ----

  describe('PUT /api/bundles/:id', () => {
    it('updates a bundle and returns 200', async () => {
      const created = await createBundle(client, {
        title: 'Old Title',
        anchorDate: '2026-01-01',
      });

      await new Promise((r) => setTimeout(r, 10));

      const res = await invoke('PUT', `/api/bundles/${created.id}`, {
        title: 'New Title',
      });

      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.strictEqual(body.bundle.title, 'New Title');
      assert.ok(body.bundle.updatedAt > created.updatedAt);
    });

    it('returns 404 when updating a non-existent bundle', async () => {
      const res = await invoke('PUT', '/api/bundles/does-not-exist', {
        title: 'New',
      });

      assert.strictEqual(res.statusCode, 404);
      const body = JSON.parse(res.body);
      assert.strictEqual(body.error, 'Bundle not found');
    });

    it('returns 400 when body is empty', async () => {
      const created = await createBundle(client, {
        title: 'Test',
        anchorDate: '2026-01-01',
      });

      const res = await invoke('PUT', `/api/bundles/${created.id}`, {});

      assert.strictEqual(res.statusCode, 400);
    });

    it('returns 400 for malformed JSON', async () => {
      const created = await createBundle(client, {
        title: 'Test',
        anchorDate: '2026-01-01',
      });

      const res = await invoke('PUT', `/api/bundles/${created.id}`, 'bad json');
      assert.strictEqual(res.statusCode, 400);
    });
  });

  // ---- DELETE /api/bundles/:id ----

  describe('DELETE /api/bundles/:id', () => {
    it('deletes an existing bundle and returns 204', async () => {
      const created = await createBundle(client, {
        title: 'Delete me',
        anchorDate: '2026-01-01',
      });

      const res = await invoke('DELETE', `/api/bundles/${created.id}`);
      assert.strictEqual(res.statusCode, 204);

      const getRes = await invoke('GET', `/api/bundles/${created.id}`);
      assert.strictEqual(getRes.statusCode, 404);
    });

    it('returns 404 when deleting a non-existent bundle', async () => {
      const res = await invoke('DELETE', '/api/bundles/does-not-exist');
      assert.strictEqual(res.statusCode, 404);
    });
  });

  // ---- GET /api/bundles/:id/tasks ----

  describe('GET /api/bundles/:id/tasks', () => {
    it('returns tasks for a bundle', async () => {
      const bundle = await createBundle(client, {
        title: 'Task List Bundle',
        anchorDate: '2026-01-01',
      });

      await createTask(client, {
        description: 'Task 1',
        bundleId: bundle.id,
        date: '2026-01-01',
        status: 'todo',
      });
      await createTask(client, {
        description: 'Task 2',
        bundleId: bundle.id,
        date: '2026-01-02',
        status: 'todo',
      });

      const res = await invoke('GET', `/api/bundles/${bundle.id}/tasks`);
      assert.strictEqual(res.statusCode, 200);

      const body = JSON.parse(res.body);
      assert.ok(Array.isArray(body.tasks));
      assert.strictEqual(body.tasks.length, 2);
      for (const task of body.tasks) {
        assert.strictEqual(task.bundleId, bundle.id);
      }
    });

    it('returns empty tasks array for bundle with no tasks', async () => {
      const bundle = await createBundle(client, {
        title: 'No Tasks Bundle',
        anchorDate: '2026-01-01',
      });

      const res = await invoke('GET', `/api/bundles/${bundle.id}/tasks`);
      assert.strictEqual(res.statusCode, 200);

      const body = JSON.parse(res.body);
      assert.ok(Array.isArray(body.tasks));
      assert.strictEqual(body.tasks.length, 0);
    });

    it('returns 404 for tasks of a non-existent bundle', async () => {
      const res = await invoke('GET', '/api/bundles/does-not-exist/tasks');
      assert.strictEqual(res.statusCode, 404);
    });
  });

  // ---- Old /api/projects returns 404 ----

  describe('Old /api/projects returns 404', () => {
    it('GET /api/projects returns 404', async () => {
      const res = await invoke('GET', '/api/projects');
      assert.strictEqual(res.statusCode, 404);
    });
  });

  // ---- Method not allowed ----

  describe('Method not allowed', () => {
    it('returns 405 for PATCH /api/bundles', async () => {
      const res = await invoke('PATCH', '/api/bundles');
      assert.strictEqual(res.statusCode, 405);
      const body = JSON.parse(res.body);
      assert.strictEqual(body.error, 'Method not allowed');
    });

    it('returns 405 for POST /api/bundles/:id', async () => {
      const bundle = await createBundle(client, {
        title: 'Test',
        anchorDate: '2026-01-01',
      });
      const res = await invoke('POST', `/api/bundles/${bundle.id}`);
      assert.strictEqual(res.statusCode, 405);
    });

    it('returns 405 for PATCH /api/bundles/:id', async () => {
      const bundle = await createBundle(client, {
        title: 'Test',
        anchorDate: '2026-01-01',
      });
      const res = await invoke('PATCH', `/api/bundles/${bundle.id}`);
      assert.strictEqual(res.statusCode, 405);
    });

    it('returns 405 for POST /api/bundles/:id/tasks', async () => {
      const bundle = await createBundle(client, {
        title: 'Test',
        anchorDate: '2026-01-01',
      });
      const res = await invoke('POST', `/api/bundles/${bundle.id}/tasks`);
      assert.strictEqual(res.statusCode, 405);
    });
  });

  // ---- Content-Type header ----

  describe('Content-Type header', () => {
    it('all API responses include Content-Type: application/json', async () => {
      const res200 = await invoke('GET', '/api/bundles');
      assert.strictEqual(res200.headers!['Content-Type'], 'application/json');

      const res404 = await invoke('GET', '/api/bundles/nonexistent');
      assert.strictEqual(res404.headers!['Content-Type'], 'application/json');

      const res201 = await invoke('POST', '/api/bundles', {
        title: 'CT Test',
        anchorDate: '2026-01-01',
      });
      assert.strictEqual(res201.headers!['Content-Type'], 'application/json');

      const res405 = await invoke('PATCH', '/api/bundles');
      assert.strictEqual(res405.headers!['Content-Type'], 'application/json');
    });
  });
});
