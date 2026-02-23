const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');

const { startLocal, stopLocal, getClient } = require('../src/db/client');
const { createTables, deleteTables } = require('../src/db/setup');

// We need to set up the DB before importing handler, because handler does
// cold-start init. Instead, we'll call the handler directly and let it
// initialize with the dynalite instance we start.

describe('API — CRUD for tasks', () => {
  let port;
  let handler;

  before(async () => {
    port = await startLocal();
    // Set IS_LOCAL so getClient() in handler uses our dynalite
    process.env.IS_LOCAL = 'true';

    // We need to ensure handler's cold-start init uses our dynalite port.
    // Since handler calls getClient() which calls startLocal() internally
    // (and dynalite is already running), it will reuse the existing server.
    const mod = require('../src/handler');
    handler = mod.handler;

    // Trigger cold start initialization
    const warmUp = await handler({ httpMethod: 'GET', path: '/api/health' }, {});
    assert.strictEqual(warmUp.statusCode, 200);
  });

  after(async () => {
    await stopLocal();
    delete process.env.IS_LOCAL;
  });

  // ── POST /api/tasks ────────────────────────────────────────────────

  describe('POST /api/tasks', () => {
    it('creates a task with required fields and returns 201', async () => {
      const event = {
        httpMethod: 'POST',
        path: '/api/tasks',
        body: JSON.stringify({ description: 'Review draft', date: '2026-03-10' }),
      };
      const res = await handler(event, {});
      assert.strictEqual(res.statusCode, 201);

      const body = JSON.parse(res.body);
      assert.ok(body.id);
      assert.strictEqual(body.description, 'Review draft');
      assert.strictEqual(body.date, '2026-03-10');
      assert.strictEqual(body.status, 'todo');
      assert.ok(body.createdAt);
      assert.ok(body.updatedAt);
    });

    it('creates a task with optional fields', async () => {
      const event = {
        httpMethod: 'POST',
        path: '/api/tasks',
        body: JSON.stringify({
          description: 'Review draft',
          date: '2026-03-10',
          comment: 'Important',
          projectId: 'proj-1',
          source: 'telegram',
        }),
      };
      const res = await handler(event, {});
      assert.strictEqual(res.statusCode, 201);

      const body = JSON.parse(res.body);
      assert.strictEqual(body.comment, 'Important');
      assert.strictEqual(body.projectId, 'proj-1');
      assert.strictEqual(body.source, 'telegram');
    });

    it('returns 400 when description is missing', async () => {
      const event = {
        httpMethod: 'POST',
        path: '/api/tasks',
        body: JSON.stringify({ date: '2026-03-10' }),
      };
      const res = await handler(event, {});
      assert.strictEqual(res.statusCode, 400);

      const body = JSON.parse(res.body);
      assert.strictEqual(body.error, 'Missing required field: description');
    });

    it('returns 400 when date is missing', async () => {
      const event = {
        httpMethod: 'POST',
        path: '/api/tasks',
        body: JSON.stringify({ description: 'Review draft' }),
      };
      const res = await handler(event, {});
      assert.strictEqual(res.statusCode, 400);

      const body = JSON.parse(res.body);
      assert.strictEqual(body.error, 'Missing required field: date');
    });

    it('returns 400 when body is invalid JSON', async () => {
      const event = {
        httpMethod: 'POST',
        path: '/api/tasks',
        body: 'not-json',
      };
      const res = await handler(event, {});
      assert.strictEqual(res.statusCode, 400);

      const body = JSON.parse(res.body);
      assert.ok(body.error);
    });

    it('returns 400 when body is null', async () => {
      const event = {
        httpMethod: 'POST',
        path: '/api/tasks',
        body: null,
      };
      const res = await handler(event, {});
      assert.strictEqual(res.statusCode, 400);

      const body = JSON.parse(res.body);
      assert.strictEqual(body.error, 'Request body is required');
    });
  });

  // ── GET /api/tasks (list with filters) ─────────────────────────────

  describe('GET /api/tasks', () => {
    it('returns tasks filtered by date', async () => {
      const uniqueDate = '2090-07-15';
      // Create two tasks for the target date
      await handler({
        httpMethod: 'POST', path: '/api/tasks',
        body: JSON.stringify({ description: 'D1', date: uniqueDate }),
      }, {});
      await handler({
        httpMethod: 'POST', path: '/api/tasks',
        body: JSON.stringify({ description: 'D2', date: uniqueDate }),
      }, {});
      // One task for a different date
      await handler({
        httpMethod: 'POST', path: '/api/tasks',
        body: JSON.stringify({ description: 'D3', date: '2090-07-16' }),
      }, {});

      const res = await handler({
        httpMethod: 'GET',
        path: '/api/tasks',
        queryStringParameters: { date: uniqueDate },
      }, {});

      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.strictEqual(body.tasks.length, 2);
      for (const task of body.tasks) {
        assert.strictEqual(task.date, uniqueDate);
      }
    });

    it('returns tasks filtered by date range', async () => {
      const d1 = '2091-06-01';
      const d2 = '2091-06-03';
      const d3 = '2091-06-05';
      await handler({
        httpMethod: 'POST', path: '/api/tasks',
        body: JSON.stringify({ description: 'R1', date: d1 }),
      }, {});
      await handler({
        httpMethod: 'POST', path: '/api/tasks',
        body: JSON.stringify({ description: 'R2', date: d2 }),
      }, {});
      await handler({
        httpMethod: 'POST', path: '/api/tasks',
        body: JSON.stringify({ description: 'R3', date: d3 }),
      }, {});

      const res = await handler({
        httpMethod: 'GET',
        path: '/api/tasks',
        queryStringParameters: { startDate: '2091-06-02', endDate: '2091-06-04' },
      }, {});

      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.strictEqual(body.tasks.length, 1);
      assert.strictEqual(body.tasks[0].description, 'R2');
    });

    it('returns tasks filtered by projectId', async () => {
      const pid = 'proj-filter-' + crypto.randomUUID();
      await handler({
        httpMethod: 'POST', path: '/api/tasks',
        body: JSON.stringify({ description: 'P1', date: '2092-01-01', projectId: pid }),
      }, {});
      await handler({
        httpMethod: 'POST', path: '/api/tasks',
        body: JSON.stringify({ description: 'P2', date: '2092-01-02', projectId: pid }),
      }, {});
      await handler({
        httpMethod: 'POST', path: '/api/tasks',
        body: JSON.stringify({ description: 'P3', date: '2092-01-01', projectId: 'other-proj' }),
      }, {});

      const res = await handler({
        httpMethod: 'GET',
        path: '/api/tasks',
        queryStringParameters: { projectId: pid },
      }, {});

      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.strictEqual(body.tasks.length, 2);
      for (const task of body.tasks) {
        assert.strictEqual(task.projectId, pid);
      }
    });

    it('returns tasks filtered by status', async () => {
      // We'll create tasks with a unique date to isolate this test
      const uniqueDate = '2093-09-09';
      await handler({
        httpMethod: 'POST', path: '/api/tasks',
        body: JSON.stringify({ description: 'S1', date: uniqueDate }),
      }, {});
      await handler({
        httpMethod: 'POST', path: '/api/tasks',
        body: JSON.stringify({ description: 'S2', date: uniqueDate }),
      }, {});
      // Mark one as done
      const createRes = await handler({
        httpMethod: 'POST', path: '/api/tasks',
        body: JSON.stringify({ description: 'S3', date: uniqueDate }),
      }, {});
      const s3 = JSON.parse(createRes.body);
      await handler({
        httpMethod: 'PUT',
        path: `/api/tasks/${s3.id}`,
        body: JSON.stringify({ status: 'done' }),
      }, {});

      // Query by status=todo — should include at least S1, S2 (and possibly other tasks from other tests)
      const res = await handler({
        httpMethod: 'GET',
        path: '/api/tasks',
        queryStringParameters: { status: 'todo' },
      }, {});

      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.ok(body.tasks.length >= 2);
      for (const task of body.tasks) {
        assert.strictEqual(task.status, 'todo');
      }
    });

    it('returns 400 when no query parameters provided', async () => {
      const res = await handler({
        httpMethod: 'GET',
        path: '/api/tasks',
        queryStringParameters: null,
      }, {});

      assert.strictEqual(res.statusCode, 400);
      const body = JSON.parse(res.body);
      assert.ok(body.error.includes('At least one filter is required'));
    });

    it('returns 400 when empty queryStringParameters object', async () => {
      const res = await handler({
        httpMethod: 'GET',
        path: '/api/tasks',
        queryStringParameters: {},
      }, {});

      assert.strictEqual(res.statusCode, 400);
      const body = JSON.parse(res.body);
      assert.ok(body.error.includes('At least one filter is required'));
    });

    it('returns 400 when startDate provided without endDate', async () => {
      const res = await handler({
        httpMethod: 'GET',
        path: '/api/tasks',
        queryStringParameters: { startDate: '2026-03-01' },
      }, {});

      assert.strictEqual(res.statusCode, 400);
      const body = JSON.parse(res.body);
      assert.strictEqual(body.error, 'Both startDate and endDate are required for range queries');
    });

    it('returns 400 when endDate provided without startDate', async () => {
      const res = await handler({
        httpMethod: 'GET',
        path: '/api/tasks',
        queryStringParameters: { endDate: '2026-03-31' },
      }, {});

      assert.strictEqual(res.statusCode, 400);
      const body = JSON.parse(res.body);
      assert.strictEqual(body.error, 'Both startDate and endDate are required for range queries');
    });

    it('returns 400 when status is invalid', async () => {
      const res = await handler({
        httpMethod: 'GET',
        path: '/api/tasks',
        queryStringParameters: { status: 'invalid' },
      }, {});

      assert.strictEqual(res.statusCode, 400);
      const body = JSON.parse(res.body);
      assert.strictEqual(body.error, "Invalid status. Must be 'todo' or 'done'");
    });
  });

  // ── GET /api/tasks/:id ─────────────────────────────────────────────

  describe('GET /api/tasks/:id', () => {
    it('returns a task by id', async () => {
      const createRes = await handler({
        httpMethod: 'POST',
        path: '/api/tasks',
        body: JSON.stringify({ description: 'Get me', date: '2026-03-10' }),
      }, {});
      const created = JSON.parse(createRes.body);

      const res = await handler({
        httpMethod: 'GET',
        path: `/api/tasks/${created.id}`,
      }, {});

      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.strictEqual(body.id, created.id);
      assert.strictEqual(body.description, 'Get me');
    });

    it('returns 404 for a nonexistent task', async () => {
      const res = await handler({
        httpMethod: 'GET',
        path: '/api/tasks/nonexistent-id-999',
      }, {});

      assert.strictEqual(res.statusCode, 404);
      const body = JSON.parse(res.body);
      assert.strictEqual(body.error, 'Task not found');
    });
  });

  // ── PUT /api/tasks/:id ─────────────────────────────────────────────

  describe('PUT /api/tasks/:id', () => {
    it('updates a task and returns 200', async () => {
      const createRes = await handler({
        httpMethod: 'POST',
        path: '/api/tasks',
        body: JSON.stringify({ description: 'Update me', date: '2026-03-10' }),
      }, {});
      const created = JSON.parse(createRes.body);

      // Small delay so updatedAt changes
      await new Promise((r) => setTimeout(r, 10));

      const res = await handler({
        httpMethod: 'PUT',
        path: `/api/tasks/${created.id}`,
        body: JSON.stringify({ status: 'done', comment: 'Completed' }),
      }, {});

      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.strictEqual(body.status, 'done');
      assert.strictEqual(body.comment, 'Completed');
      assert.strictEqual(body.description, 'Update me');
      assert.ok(body.updatedAt > created.updatedAt);
    });

    it('returns 404 for a nonexistent task', async () => {
      const res = await handler({
        httpMethod: 'PUT',
        path: '/api/tasks/nonexistent-id-999',
        body: JSON.stringify({ status: 'done' }),
      }, {});

      assert.strictEqual(res.statusCode, 404);
      const body = JSON.parse(res.body);
      assert.strictEqual(body.error, 'Task not found');
    });

    it('returns 400 when body is empty', async () => {
      const createRes = await handler({
        httpMethod: 'POST',
        path: '/api/tasks',
        body: JSON.stringify({ description: 'No update', date: '2026-03-10' }),
      }, {});
      const created = JSON.parse(createRes.body);

      const res = await handler({
        httpMethod: 'PUT',
        path: `/api/tasks/${created.id}`,
        body: null,
      }, {});

      assert.strictEqual(res.statusCode, 400);
      const body = JSON.parse(res.body);
      assert.strictEqual(body.error, 'Request body is required');
    });

    it('returns 400 when body is invalid JSON', async () => {
      const createRes = await handler({
        httpMethod: 'POST',
        path: '/api/tasks',
        body: JSON.stringify({ description: 'Bad update', date: '2026-03-10' }),
      }, {});
      const created = JSON.parse(createRes.body);

      const res = await handler({
        httpMethod: 'PUT',
        path: `/api/tasks/${created.id}`,
        body: 'not-json',
      }, {});

      assert.strictEqual(res.statusCode, 400);
      const body = JSON.parse(res.body);
      assert.strictEqual(body.error, 'Request body is required');
    });

    it('strips disallowed fields and only updates allowed ones', async () => {
      const createRes = await handler({
        httpMethod: 'POST',
        path: '/api/tasks',
        body: JSON.stringify({ description: 'Strip test', date: '2026-03-10' }),
      }, {});
      const created = JSON.parse(createRes.body);

      const res = await handler({
        httpMethod: 'PUT',
        path: `/api/tasks/${created.id}`,
        body: JSON.stringify({ status: 'done', id: 'hacked', PK: 'bad', createdAt: '1999-01-01' }),
      }, {});

      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.strictEqual(body.id, created.id); // id NOT changed
      assert.strictEqual(body.status, 'done');
      assert.ok(!body.PK); // PK stripped by cleanItem
    });

    it('returns 400 when only disallowed fields are provided', async () => {
      const createRes = await handler({
        httpMethod: 'POST',
        path: '/api/tasks',
        body: JSON.stringify({ description: 'No valid', date: '2026-03-10' }),
      }, {});
      const created = JSON.parse(createRes.body);

      const res = await handler({
        httpMethod: 'PUT',
        path: `/api/tasks/${created.id}`,
        body: JSON.stringify({ id: 'hacked', PK: 'bad' }),
      }, {});

      assert.strictEqual(res.statusCode, 400);
      const body = JSON.parse(res.body);
      assert.strictEqual(body.error, 'No valid fields to update');
    });
  });

  // ── DELETE /api/tasks/:id ──────────────────────────────────────────

  describe('DELETE /api/tasks/:id', () => {
    it('deletes a task and returns 204', async () => {
      const createRes = await handler({
        httpMethod: 'POST',
        path: '/api/tasks',
        body: JSON.stringify({ description: 'Delete me', date: '2026-03-10' }),
      }, {});
      const created = JSON.parse(createRes.body);

      const res = await handler({
        httpMethod: 'DELETE',
        path: `/api/tasks/${created.id}`,
      }, {});

      assert.strictEqual(res.statusCode, 204);
      assert.strictEqual(res.body, '');

      // Verify the task is gone
      const getRes = await handler({
        httpMethod: 'GET',
        path: `/api/tasks/${created.id}`,
      }, {});
      assert.strictEqual(getRes.statusCode, 404);
    });

    it('returns 204 for a nonexistent task (idempotent)', async () => {
      const res = await handler({
        httpMethod: 'DELETE',
        path: '/api/tasks/nonexistent-id-999',
      }, {});

      assert.strictEqual(res.statusCode, 204);
      assert.strictEqual(res.body, '');
    });
  });

  // ── Existing routes still work ─────────────────────────────────────

  describe('Existing routes', () => {
    it('GET / returns SPA HTML with status 200', async () => {
      const res = await handler({ httpMethod: 'GET', path: '/' }, {});
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.headers['Content-Type'], 'text/html');
      assert.ok(res.body.includes('<title>DataTasks</title>'));
    });

    it('GET /api/health returns 200', async () => {
      const res = await handler({ httpMethod: 'GET', path: '/api/health' }, {});
      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.deepStrictEqual(body, { status: 'ok' });
    });

    it('GET /api/unknown returns 404', async () => {
      const res = await handler({ httpMethod: 'GET', path: '/api/unknown' }, {});
      assert.strictEqual(res.statusCode, 404);
    });
  });

  // ── Error handling ─────────────────────────────────────────────────

  describe('Error handling — 500 on unexpected errors', () => {
    it('returns 500 when an unexpected error occurs', async () => {
      // Import route directly and pass a broken client to trigger an error
      const { route } = require('../src/router');

      const brokenClient = {
        send: () => { throw new Error('Simulated DB failure'); },
      };

      const res = await route(
        {
          httpMethod: 'GET',
          path: '/api/tasks',
          queryStringParameters: { date: '2026-01-01' },
        },
        brokenClient,
      );

      assert.strictEqual(res.statusCode, 500);
      const body = JSON.parse(res.body);
      assert.strictEqual(body.error, 'Internal server error');
    });
  });

  // ── Ad hoc task polish (issue #9) ──────────────────────────────────

  describe('Source defaults to manual', () => {
    it('creating a task without source defaults to "manual"', async () => {
      const event = {
        httpMethod: 'POST',
        path: '/api/tasks',
        body: JSON.stringify({ description: 'Ad hoc task', date: '2096-01-01' }),
      };
      const res = await handler(event, {});
      assert.strictEqual(res.statusCode, 201);

      const body = JSON.parse(res.body);
      assert.strictEqual(body.source, 'manual');
    });

    it('creating a task with an explicit source preserves it', async () => {
      const event = {
        httpMethod: 'POST',
        path: '/api/tasks',
        body: JSON.stringify({ description: 'Bot task', date: '2096-01-02', source: 'telegram' }),
      };
      const res = await handler(event, {});
      assert.strictEqual(res.statusCode, 201);

      const body = JSON.parse(res.body);
      assert.strictEqual(body.source, 'telegram');
    });
  });

  describe('Creating a task with a comment', () => {
    it('creates a task with a comment field', async () => {
      const event = {
        httpMethod: 'POST',
        path: '/api/tasks',
        body: JSON.stringify({
          description: 'Task with comment',
          date: '2096-02-01',
          comment: 'This is a note',
        }),
      };
      const res = await handler(event, {});
      assert.strictEqual(res.statusCode, 201);

      const body = JSON.parse(res.body);
      assert.strictEqual(body.comment, 'This is a note');
      assert.strictEqual(body.source, 'manual');
    });

    it('creates a task without a comment field', async () => {
      const event = {
        httpMethod: 'POST',
        path: '/api/tasks',
        body: JSON.stringify({
          description: 'Task without comment',
          date: '2096-02-02',
        }),
      };
      const res = await handler(event, {});
      assert.strictEqual(res.statusCode, 201);

      const body = JSON.parse(res.body);
      assert.strictEqual(body.comment, undefined);
    });
  });

  describe('Full lifecycle of ad hoc task', () => {
    it('create, list, update, mark done, delete', async () => {
      const uniqueDate = '2097-11-11';

      // 1. Create an ad hoc task (no projectId)
      const createRes = await handler({
        httpMethod: 'POST',
        path: '/api/tasks',
        body: JSON.stringify({
          description: 'Lifecycle ad hoc task',
          date: uniqueDate,
          comment: 'Initial comment',
        }),
      }, {});
      assert.strictEqual(createRes.statusCode, 201);
      const created = JSON.parse(createRes.body);
      assert.ok(created.id);
      assert.strictEqual(created.source, 'manual');
      assert.strictEqual(created.projectId, undefined);
      assert.strictEqual(created.status, 'todo');
      assert.strictEqual(created.comment, 'Initial comment');

      // 2. Verify it appears in the task list (by date)
      const listRes = await handler({
        httpMethod: 'GET',
        path: '/api/tasks',
        queryStringParameters: { date: uniqueDate },
      }, {});
      assert.strictEqual(listRes.statusCode, 200);
      const listBody = JSON.parse(listRes.body);
      const found = listBody.tasks.find(function (t) { return t.id === created.id; });
      assert.ok(found, 'Ad hoc task should appear in task list');
      assert.strictEqual(found.description, 'Lifecycle ad hoc task');

      // 3. Update the description
      const updateRes = await handler({
        httpMethod: 'PUT',
        path: '/api/tasks/' + created.id,
        body: JSON.stringify({ description: 'Updated ad hoc task' }),
      }, {});
      assert.strictEqual(updateRes.statusCode, 200);
      const updated = JSON.parse(updateRes.body);
      assert.strictEqual(updated.description, 'Updated ad hoc task');

      // 4. Mark as done
      const doneRes = await handler({
        httpMethod: 'PUT',
        path: '/api/tasks/' + created.id,
        body: JSON.stringify({ status: 'done' }),
      }, {});
      assert.strictEqual(doneRes.statusCode, 200);
      const done = JSON.parse(doneRes.body);
      assert.strictEqual(done.status, 'done');

      // 5. Verify status persisted
      const getRes = await handler({
        httpMethod: 'GET',
        path: '/api/tasks/' + created.id,
      }, {});
      assert.strictEqual(getRes.statusCode, 200);
      const fetched = JSON.parse(getRes.body);
      assert.strictEqual(fetched.status, 'done');
      assert.strictEqual(fetched.description, 'Updated ad hoc task');

      // 6. Delete the task
      const deleteRes = await handler({
        httpMethod: 'DELETE',
        path: '/api/tasks/' + created.id,
      }, {});
      assert.strictEqual(deleteRes.statusCode, 204);

      // 7. Verify it's gone
      const goneRes = await handler({
        httpMethod: 'GET',
        path: '/api/tasks/' + created.id,
      }, {});
      assert.strictEqual(goneRes.statusCode, 404);
    });
  });
});
