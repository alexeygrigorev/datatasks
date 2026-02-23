const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');

const { startLocal, stopLocal, getClient } = require('../src/db/client');
const { createTables } = require('../src/db/setup');
const {
  createRecurringConfig,
  getRecurringConfig,
  updateRecurringConfig,
  deleteRecurringConfig,
  listRecurringConfigs,
  listEnabledRecurringConfigs,
  generateRecurringTasks,
} = require('../src/db/recurring');
const { getTask } = require('../src/db/tasks');

describe('Recurring configs data layer', () => {
  let client;
  let port;

  before(async () => {
    port = await startLocal();
    client = await getClient(port);
    await createTables(client);
  });

  after(async () => {
    await stopLocal();
  });

  it('createRecurringConfig returns a config with id, createdAt, updatedAt, enabled', async () => {
    const config = await createRecurringConfig(client, {
      description: 'Daily standup',
      schedule: 'daily',
    });

    assert.ok(config.id);
    assert.ok(config.createdAt);
    assert.ok(config.updatedAt);
    assert.strictEqual(config.description, 'Daily standup');
    assert.strictEqual(config.schedule, 'daily');
    assert.strictEqual(config.enabled, true);
    assert.strictEqual(config.PK, undefined);
    assert.strictEqual(config.SK, undefined);
  });

  it('createRecurringConfig with weekly schedule and dayOfWeek', async () => {
    const config = await createRecurringConfig(client, {
      description: 'Weekly mailchimp dump',
      schedule: 'weekly',
      dayOfWeek: 3,
    });

    assert.strictEqual(config.schedule, 'weekly');
    assert.strictEqual(config.dayOfWeek, 3);
  });

  it('createRecurringConfig with monthly schedule and dayOfMonth', async () => {
    const config = await createRecurringConfig(client, {
      description: 'Monthly report',
      schedule: 'monthly',
      dayOfMonth: 15,
    });

    assert.strictEqual(config.schedule, 'monthly');
    assert.strictEqual(config.dayOfMonth, 15);
  });

  it('getRecurringConfig returns the config by id', async () => {
    const created = await createRecurringConfig(client, {
      description: 'Fetch test',
      schedule: 'daily',
    });
    const fetched = await getRecurringConfig(client, created.id);

    assert.ok(fetched);
    assert.strictEqual(fetched.id, created.id);
    assert.strictEqual(fetched.description, 'Fetch test');
  });

  it('getRecurringConfig returns null for non-existent id', async () => {
    const result = await getRecurringConfig(client, 'nonexistent');
    assert.strictEqual(result, null);
  });

  it('updateRecurringConfig performs partial update and refreshes updatedAt', async () => {
    const created = await createRecurringConfig(client, {
      description: 'Original',
      schedule: 'daily',
    });

    await new Promise((r) => setTimeout(r, 10));

    const updated = await updateRecurringConfig(client, created.id, {
      description: 'Updated',
      enabled: false,
    });

    assert.strictEqual(updated.description, 'Updated');
    assert.strictEqual(updated.enabled, false);
    assert.strictEqual(updated.schedule, 'daily');
    assert.ok(updated.updatedAt > created.updatedAt);
  });

  it('deleteRecurringConfig removes the config', async () => {
    const created = await createRecurringConfig(client, {
      description: 'Delete me',
      schedule: 'daily',
    });
    await deleteRecurringConfig(client, created.id);
    const result = await getRecurringConfig(client, created.id);
    assert.strictEqual(result, null);
  });

  it('listRecurringConfigs returns all configs', async () => {
    const c1 = await createRecurringConfig(client, {
      description: 'List 1',
      schedule: 'daily',
    });
    const c2 = await createRecurringConfig(client, {
      description: 'List 2',
      schedule: 'weekly',
      dayOfWeek: 1,
    });

    const configs = await listRecurringConfigs(client);
    const ids = configs.map((c) => c.id);

    assert.ok(ids.includes(c1.id));
    assert.ok(ids.includes(c2.id));
    assert.ok(configs.length >= 2);
  });

  it('listEnabledRecurringConfigs returns only enabled configs', async () => {
    const enabled = await createRecurringConfig(client, {
      description: 'Enabled config',
      schedule: 'daily',
    });
    const disabled = await createRecurringConfig(client, {
      description: 'Disabled config',
      schedule: 'daily',
      enabled: false,
    });

    const configs = await listEnabledRecurringConfigs(client);
    const ids = configs.map((c) => c.id);

    assert.ok(ids.includes(enabled.id));
    assert.ok(!ids.includes(disabled.id));
  });

  // ── Generation tests ────────────────────────────────────────────
  // These tests use unique date ranges that don't overlap with other tests
  // to ensure isolation without needing table deletion/recreation.

  it('generateRecurringTasks creates daily tasks for each day in range', async () => {
    // Disable all existing configs to isolate this test
    const allConfigs = await listRecurringConfigs(client);
    for (const c of allConfigs) {
      if (c.enabled) {
        await updateRecurringConfig(client, c.id, { enabled: false });
      }
    }

    const config = await createRecurringConfig(client, {
      description: 'Gen daily standup',
      schedule: 'daily',
    });

    // Use a unique date range for this test
    const result = await generateRecurringTasks(client, '2027-01-02', '2027-01-04');

    assert.strictEqual(result.generated.length, 3);
    assert.strictEqual(result.skipped, 0);

    const dates = result.generated.map((t) => t.date).sort();
    assert.deepStrictEqual(dates, ['2027-01-02', '2027-01-03', '2027-01-04']);

    // Verify task attributes
    for (const task of result.generated) {
      assert.strictEqual(task.source, 'recurring');
      assert.strictEqual(task.status, 'todo');
      assert.strictEqual(task.description, 'Gen daily standup');
      assert.strictEqual(task.recurringConfigId, config.id);
    }

    // Verify tasks are persisted
    for (const task of result.generated) {
      const fetched = await getTask(client, task.id);
      assert.ok(fetched, `Task ${task.id} should be persisted`);
    }

    // Cleanup: disable the config
    await updateRecurringConfig(client, config.id, { enabled: false });
  });

  it('generateRecurringTasks creates weekly tasks only on matching dayOfWeek', async () => {
    // Disable all existing enabled configs
    const allConfigs = await listRecurringConfigs(client);
    for (const c of allConfigs) {
      if (c.enabled) {
        await updateRecurringConfig(client, c.id, { enabled: false });
      }
    }

    // dayOfWeek 3 = Wednesday
    const config = await createRecurringConfig(client, {
      description: 'Gen weekly mailchimp',
      schedule: 'weekly',
      dayOfWeek: 3,
    });

    // 2027-02-01 is Monday, 2027-02-14 is Sunday
    // Wednesdays: 2027-02-03 and 2027-02-10
    const result = await generateRecurringTasks(client, '2027-02-01', '2027-02-14');

    assert.strictEqual(result.generated.length, 2);
    const dates = result.generated.map((t) => t.date).sort();
    assert.deepStrictEqual(dates, ['2027-02-03', '2027-02-10']);

    await updateRecurringConfig(client, config.id, { enabled: false });
  });

  it('generateRecurringTasks creates monthly tasks only on matching dayOfMonth', async () => {
    const allConfigs = await listRecurringConfigs(client);
    for (const c of allConfigs) {
      if (c.enabled) {
        await updateRecurringConfig(client, c.id, { enabled: false });
      }
    }

    const config = await createRecurringConfig(client, {
      description: 'Gen monthly report',
      schedule: 'monthly',
      dayOfMonth: 15,
    });

    const result = await generateRecurringTasks(client, '2027-06-01', '2027-08-31');

    assert.strictEqual(result.generated.length, 3);
    const dates = result.generated.map((t) => t.date).sort();
    assert.deepStrictEqual(dates, ['2027-06-15', '2027-07-15', '2027-08-15']);

    await updateRecurringConfig(client, config.id, { enabled: false });
  });

  it('generateRecurringTasks is idempotent — no duplicates on second call', async () => {
    const allConfigs = await listRecurringConfigs(client);
    for (const c of allConfigs) {
      if (c.enabled) {
        await updateRecurringConfig(client, c.id, { enabled: false });
      }
    }

    const config = await createRecurringConfig(client, {
      description: 'Gen idempotent daily',
      schedule: 'daily',
    });

    // First generation
    const result1 = await generateRecurringTasks(client, '2027-03-02', '2027-03-04');
    assert.strictEqual(result1.generated.length, 3);
    assert.strictEqual(result1.skipped, 0);

    // Second generation — same range
    const result2 = await generateRecurringTasks(client, '2027-03-02', '2027-03-04');
    assert.strictEqual(result2.generated.length, 0);
    assert.strictEqual(result2.skipped, 3);

    await updateRecurringConfig(client, config.id, { enabled: false });
  });

  it('generateRecurringTasks skips disabled configs', async () => {
    const allConfigs = await listRecurringConfigs(client);
    for (const c of allConfigs) {
      if (c.enabled) {
        await updateRecurringConfig(client, c.id, { enabled: false });
      }
    }

    await createRecurringConfig(client, {
      description: 'Gen disabled daily',
      schedule: 'daily',
      enabled: false,
    });

    const result = await generateRecurringTasks(client, '2027-04-02', '2027-04-04');
    assert.strictEqual(result.generated.length, 0);
    assert.strictEqual(result.skipped, 0);
  });

  it('generateRecurringTasks sets projectId from config', async () => {
    const allConfigs = await listRecurringConfigs(client);
    for (const c of allConfigs) {
      if (c.enabled) {
        await updateRecurringConfig(client, c.id, { enabled: false });
      }
    }

    const config = await createRecurringConfig(client, {
      description: 'Gen project task',
      schedule: 'daily',
      projectId: 'proj-gen-123',
    });

    const result = await generateRecurringTasks(client, '2027-05-02', '2027-05-02');
    assert.strictEqual(result.generated.length, 1);
    assert.strictEqual(result.generated[0].projectId, 'proj-gen-123');

    await updateRecurringConfig(client, config.id, { enabled: false });
  });
});
