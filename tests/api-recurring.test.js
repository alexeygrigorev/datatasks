const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');

const { handler } = require('../src/handler');
const { startLocal, stopLocal, getClient } = require('../src/db/client');
const { createTables } = require('../src/db/setup');
const {
  createRecurringConfig,
  listRecurringConfigs,
  updateRecurringConfig,
} = require('../src/db/recurring');

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

/**
 * Helper to disable all enabled recurring configs for test isolation.
 */
async function disableAllConfigs(client) {
  const allConfigs = await listRecurringConfigs(client);
  for (const c of allConfigs) {
    if (c.enabled) {
      await updateRecurringConfig(client, c.id, { enabled: false });
    }
  }
}

describe('API — Recurring', () => {
  let client;

  before(async () => {
    const port = await startLocal();
    client = await getClient(port);
    await createTables(client);
  });

  after(async () => {
    await stopLocal();
  });

  // ── POST /api/recurring ──────────────────────────────────────

  describe('POST /api/recurring', () => {
    it('creates a daily recurring config and returns 201', async () => {
      const res = await invoke('POST', '/api/recurring', {
        description: 'Daily standup',
        schedule: 'daily',
      });

      assert.strictEqual(res.statusCode, 201);
      const body = JSON.parse(res.body);
      assert.ok(body.recurringConfig);
      assert.ok(body.recurringConfig.id);
      assert.strictEqual(body.recurringConfig.description, 'Daily standup');
      assert.strictEqual(body.recurringConfig.schedule, 'daily');
      assert.strictEqual(body.recurringConfig.enabled, true);
      assert.ok(body.recurringConfig.createdAt);
      assert.ok(body.recurringConfig.updatedAt);
    });

    it('creates a weekly recurring config with dayOfWeek', async () => {
      const res = await invoke('POST', '/api/recurring', {
        description: 'Weekly mailchimp dump',
        schedule: 'weekly',
        dayOfWeek: 3,
      });

      assert.strictEqual(res.statusCode, 201);
      const body = JSON.parse(res.body);
      assert.strictEqual(body.recurringConfig.schedule, 'weekly');
      assert.strictEqual(body.recurringConfig.dayOfWeek, 3);
    });

    it('creates a monthly recurring config with dayOfMonth', async () => {
      const res = await invoke('POST', '/api/recurring', {
        description: 'Monthly report',
        schedule: 'monthly',
        dayOfMonth: 15,
      });

      assert.strictEqual(res.statusCode, 201);
      const body = JSON.parse(res.body);
      assert.strictEqual(body.recurringConfig.schedule, 'monthly');
      assert.strictEqual(body.recurringConfig.dayOfMonth, 15);
    });

    it('returns 400 when description is missing', async () => {
      const res = await invoke('POST', '/api/recurring', {
        schedule: 'daily',
      });

      assert.strictEqual(res.statusCode, 400);
      const body = JSON.parse(res.body);
      assert.ok(body.error.toLowerCase().includes('description'));
    });

    it('returns 400 when schedule is invalid', async () => {
      const res = await invoke('POST', '/api/recurring', {
        description: 'Test',
        schedule: 'biweekly',
      });

      assert.strictEqual(res.statusCode, 400);
      const body = JSON.parse(res.body);
      assert.ok(body.error.toLowerCase().includes('schedule'));
    });

    it('returns 400 when schedule is weekly but dayOfWeek is missing', async () => {
      const res = await invoke('POST', '/api/recurring', {
        description: 'Test',
        schedule: 'weekly',
      });

      assert.strictEqual(res.statusCode, 400);
      const body = JSON.parse(res.body);
      assert.ok(body.error.toLowerCase().includes('dayofweek'));
    });

    it('returns 400 when schedule is weekly and dayOfWeek is out of range', async () => {
      const res = await invoke('POST', '/api/recurring', {
        description: 'Test',
        schedule: 'weekly',
        dayOfWeek: 7,
      });

      assert.strictEqual(res.statusCode, 400);
      const body = JSON.parse(res.body);
      assert.ok(body.error.toLowerCase().includes('dayofweek'));
    });

    it('returns 400 when schedule is monthly but dayOfMonth is missing', async () => {
      const res = await invoke('POST', '/api/recurring', {
        description: 'Test',
        schedule: 'monthly',
      });

      assert.strictEqual(res.statusCode, 400);
      const body = JSON.parse(res.body);
      assert.ok(body.error.toLowerCase().includes('dayofmonth'));
    });

    it('returns 400 when schedule is monthly and dayOfMonth is out of range', async () => {
      const res = await invoke('POST', '/api/recurring', {
        description: 'Test',
        schedule: 'monthly',
        dayOfMonth: 32,
      });

      assert.strictEqual(res.statusCode, 400);
      const body = JSON.parse(res.body);
      assert.ok(body.error.toLowerCase().includes('dayofmonth'));
    });

    it('returns 400 for malformed JSON body', async () => {
      const res = await invoke('POST', '/api/recurring', 'not valid json{{');

      assert.strictEqual(res.statusCode, 400);
      const body = JSON.parse(res.body);
      assert.strictEqual(body.error, 'Invalid JSON');
    });
  });

  // ── GET /api/recurring ───────────────────────────────────────

  describe('GET /api/recurring', () => {
    it('returns 200 with an array of recurring configs', async () => {
      const res = await invoke('GET', '/api/recurring');

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.headers['Content-Type'], 'application/json');

      const body = JSON.parse(res.body);
      assert.ok(Array.isArray(body.recurringConfigs));
      assert.ok(body.recurringConfigs.length > 0);
    });
  });

  // ── GET /api/recurring/:id ──────────────────────────────────

  describe('GET /api/recurring/:id', () => {
    it('returns 200 with the config for a valid id', async () => {
      const created = await createRecurringConfig(client, {
        description: 'Get test',
        schedule: 'daily',
      });

      const res = await invoke('GET', `/api/recurring/${created.id}`);
      assert.strictEqual(res.statusCode, 200);

      const body = JSON.parse(res.body);
      assert.ok(body.recurringConfig);
      assert.strictEqual(body.recurringConfig.id, created.id);
      assert.strictEqual(body.recurringConfig.description, 'Get test');
    });

    it('returns 404 for a non-existent config', async () => {
      const res = await invoke('GET', '/api/recurring/does-not-exist');

      assert.strictEqual(res.statusCode, 404);
      const body = JSON.parse(res.body);
      assert.ok(body.error.includes('not found'));
    });
  });

  // ── PUT /api/recurring/:id ──────────────────────────────────

  describe('PUT /api/recurring/:id', () => {
    it('updates a config and returns 200', async () => {
      const created = await createRecurringConfig(client, {
        description: 'Old description',
        schedule: 'daily',
      });

      await new Promise((r) => setTimeout(r, 10));

      const res = await invoke('PUT', `/api/recurring/${created.id}`, {
        description: 'New description',
        enabled: false,
      });

      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.strictEqual(body.recurringConfig.description, 'New description');
      assert.strictEqual(body.recurringConfig.enabled, false);
      assert.ok(body.recurringConfig.updatedAt > created.updatedAt);
    });

    it('returns 404 when updating a non-existent config', async () => {
      const res = await invoke('PUT', '/api/recurring/does-not-exist', {
        description: 'New',
      });

      assert.strictEqual(res.statusCode, 404);
    });

    it('returns 400 when body is empty', async () => {
      const created = await createRecurringConfig(client, {
        description: 'Test',
        schedule: 'daily',
      });

      const res = await invoke('PUT', `/api/recurring/${created.id}`, {});
      assert.strictEqual(res.statusCode, 400);
    });

    it('returns 400 when body has no valid fields', async () => {
      const created = await createRecurringConfig(client, {
        description: 'Test',
        schedule: 'daily',
      });

      const res = await invoke('PUT', `/api/recurring/${created.id}`, {
        unknownField: 'value',
      });

      assert.strictEqual(res.statusCode, 400);
      const body = JSON.parse(res.body);
      assert.ok(body.error.toLowerCase().includes('no valid fields'));
    });

    it('returns 400 for malformed JSON', async () => {
      const created = await createRecurringConfig(client, {
        description: 'Test',
        schedule: 'daily',
      });

      const res = await invoke('PUT', `/api/recurring/${created.id}`, 'bad json');
      assert.strictEqual(res.statusCode, 400);
    });
  });

  // ── DELETE /api/recurring/:id ───────────────────────────────

  describe('DELETE /api/recurring/:id', () => {
    it('deletes an existing config and returns 204', async () => {
      const created = await createRecurringConfig(client, {
        description: 'Delete me',
        schedule: 'daily',
      });

      const res = await invoke('DELETE', `/api/recurring/${created.id}`);
      assert.strictEqual(res.statusCode, 204);

      // Verify it's gone
      const getRes = await invoke('GET', `/api/recurring/${created.id}`);
      assert.strictEqual(getRes.statusCode, 404);
    });

    it('returns 404 when deleting a non-existent config', async () => {
      const res = await invoke('DELETE', '/api/recurring/does-not-exist');
      assert.strictEqual(res.statusCode, 404);
    });
  });

  // ── POST /api/recurring/generate ────────────────────────────

  describe('POST /api/recurring/generate', () => {
    it('generates daily tasks for the given range', async () => {
      await disableAllConfigs(client);

      await createRecurringConfig(client, {
        description: 'API gen standup',
        schedule: 'daily',
      });

      const res = await invoke('POST', '/api/recurring/generate', {
        startDate: '2028-01-02',
        endDate: '2028-01-04',
      });

      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.strictEqual(body.generated.length, 3);
      assert.strictEqual(body.skipped, 0);

      for (const task of body.generated) {
        assert.strictEqual(task.source, 'recurring');
        assert.strictEqual(task.status, 'todo');
        assert.strictEqual(task.description, 'API gen standup');
      }
    });

    it('is idempotent — second call skips existing tasks', async () => {
      // Re-run with same date range (config from previous test still enabled)
      const res = await invoke('POST', '/api/recurring/generate', {
        startDate: '2028-01-02',
        endDate: '2028-01-04',
      });

      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.strictEqual(body.generated.length, 0);
      assert.strictEqual(body.skipped, 3);
    });

    it('generates weekly tasks only on matching dayOfWeek', async () => {
      await disableAllConfigs(client);

      // Wednesday = dayOfWeek 3
      await createRecurringConfig(client, {
        description: 'API gen wednesday',
        schedule: 'weekly',
        dayOfWeek: 3,
      });

      const res = await invoke('POST', '/api/recurring/generate', {
        startDate: '2028-02-01',
        endDate: '2028-02-14',
      });

      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.body);
      // 2028-02-01 is Tuesday. Wednesdays: Feb 2, Feb 9
      assert.strictEqual(body.generated.length, 2);
      const dates = body.generated.map((t) => t.date).sort();
      assert.deepStrictEqual(dates, ['2028-02-02', '2028-02-09']);
    });

    it('generates monthly tasks only on matching dayOfMonth', async () => {
      await disableAllConfigs(client);

      await createRecurringConfig(client, {
        description: 'API gen monthly report',
        schedule: 'monthly',
        dayOfMonth: 15,
      });

      const res = await invoke('POST', '/api/recurring/generate', {
        startDate: '2028-06-01',
        endDate: '2028-08-30',
      });

      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.strictEqual(body.generated.length, 3);
      const dates = body.generated.map((t) => t.date).sort();
      assert.deepStrictEqual(dates, ['2028-06-15', '2028-07-15', '2028-08-15']);
    });

    it('skips disabled configs', async () => {
      await disableAllConfigs(client);

      await createRecurringConfig(client, {
        description: 'API gen disabled',
        schedule: 'daily',
        enabled: false,
      });

      const res = await invoke('POST', '/api/recurring/generate', {
        startDate: '2028-04-02',
        endDate: '2028-04-04',
      });

      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.strictEqual(body.generated.length, 0);
      assert.strictEqual(body.skipped, 0);
    });

    it('returns 400 when startDate is missing', async () => {
      const res = await invoke('POST', '/api/recurring/generate', {
        endDate: '2028-03-04',
      });

      assert.strictEqual(res.statusCode, 400);
      const body = JSON.parse(res.body);
      assert.ok(body.error.includes('startDate'));
    });

    it('returns 400 when endDate is missing', async () => {
      const res = await invoke('POST', '/api/recurring/generate', {
        startDate: '2028-03-02',
      });

      assert.strictEqual(res.statusCode, 400);
      const body = JSON.parse(res.body);
      assert.ok(body.error.includes('endDate'));
    });

    it('returns 400 when date range exceeds 90 days', async () => {
      const res = await invoke('POST', '/api/recurring/generate', {
        startDate: '2028-01-01',
        endDate: '2028-06-01',
      });

      assert.strictEqual(res.statusCode, 400);
      const body = JSON.parse(res.body);
      assert.ok(body.error.includes('90 days'));
    });

    it('returns 400 when endDate is before startDate', async () => {
      const res = await invoke('POST', '/api/recurring/generate', {
        startDate: '2028-03-10',
        endDate: '2028-03-01',
      });

      assert.strictEqual(res.statusCode, 400);
    });

    it('returns 400 for invalid JSON body', async () => {
      const res = await invoke('POST', '/api/recurring/generate', 'not json{{');

      assert.strictEqual(res.statusCode, 400);
    });

    it('generated tasks are visible via normal task queries', async () => {
      await disableAllConfigs(client);

      await createRecurringConfig(client, {
        description: 'API visible standup',
        schedule: 'daily',
      });

      await invoke('POST', '/api/recurring/generate', {
        startDate: '2028-09-02',
        endDate: '2028-09-02',
      });

      // Query tasks for that date
      const taskRes = await handler(
        {
          httpMethod: 'GET',
          path: '/api/tasks',
          body: null,
          queryStringParameters: { date: '2028-09-02' },
        },
        {}
      );

      assert.strictEqual(taskRes.statusCode, 200);
      const taskBody = JSON.parse(taskRes.body);
      const recurringTasks = taskBody.tasks.filter((t) => t.source === 'recurring');
      assert.ok(recurringTasks.length >= 1);
      assert.strictEqual(recurringTasks[0].description, 'API visible standup');
    });
  });

  // ── Method not allowed ──────────────────────────────────────

  describe('Method not allowed', () => {
    it('returns 405 for PATCH /api/recurring', async () => {
      const res = await invoke('PATCH', '/api/recurring');
      assert.strictEqual(res.statusCode, 405);
    });

    it('returns 405 for GET /api/recurring/generate', async () => {
      const res = await invoke('GET', '/api/recurring/generate');
      assert.strictEqual(res.statusCode, 405);
    });
  });

  // ── Content-Type header ─────────────────────────────────────

  describe('Content-Type header', () => {
    it('all API responses include Content-Type: application/json', async () => {
      const res200 = await invoke('GET', '/api/recurring');
      assert.strictEqual(res200.headers['Content-Type'], 'application/json');

      const res404 = await invoke('GET', '/api/recurring/nonexistent');
      assert.strictEqual(res404.headers['Content-Type'], 'application/json');

      const res201 = await invoke('POST', '/api/recurring', {
        description: 'CT Test',
        schedule: 'daily',
      });
      assert.strictEqual(res201.headers['Content-Type'], 'application/json');

      const res405 = await invoke('PATCH', '/api/recurring');
      assert.strictEqual(res405.headers['Content-Type'], 'application/json');
    });
  });
});
