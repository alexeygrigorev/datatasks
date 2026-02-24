import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

import { startLocal, stopLocal, getClient } from '../src/db/client';
import { createTables, deleteTables } from '../src/db/setup';
import {
  createTemplate,
  getTemplate,
  updateTemplate,
  deleteTemplate,
  listTemplates,
  instantiateTemplate,
} from '../src/db/templates';
import { getTask } from '../src/db/tasks';

describe('Templates data layer', () => {
  let client: DynamoDBDocumentClient;
  let port: number;

  before(async () => {
    port = await startLocal();
    client = await getClient(port);
    await createTables(client);
  });

  after(async () => {
    await stopLocal();
  });

  it('createTemplate returns a template with id, createdAt, updatedAt', async () => {
    const template = await createTemplate(client, {
      name: 'Sprint template',
      taskDefinitions: [
        { refId: 'plan', description: 'Sprint planning', offsetDays: 0 },
        { refId: 'review', description: 'Sprint review', offsetDays: 14 },
      ],
    });

    assert.ok(template.id);
    assert.ok(template.createdAt);
    assert.ok(template.updatedAt);
    assert.strictEqual(template.name, 'Sprint template');
    assert.strictEqual(template.taskDefinitions!.length, 2);
    assert.strictEqual((template as Record<string, unknown>).PK, undefined);
    assert.strictEqual((template as Record<string, unknown>).SK, undefined);
  });

  it('getTemplate returns the template by id', async () => {
    const created = await createTemplate(client, { name: 'Fetch template' });
    const fetched = await getTemplate(client, created.id);

    assert.ok(fetched);
    assert.strictEqual(fetched.id, created.id);
    assert.strictEqual(fetched.name, 'Fetch template');
  });

  it('getTemplate returns null for non-existent id', async () => {
    const result = await getTemplate(client, 'nope');
    assert.strictEqual(result, null);
  });

  it('updateTemplate performs partial update and refreshes updatedAt', async () => {
    const created = await createTemplate(client, {
      name: 'Original',
      category: 'sprint',
    });

    await new Promise((r) => setTimeout(r, 10));

    const updated = await updateTemplate(client, created.id, {
      name: 'Updated',
    });

    assert.strictEqual(updated.name, 'Updated');
    assert.strictEqual(updated.category, 'sprint');
    assert.ok(updated.updatedAt > created.updatedAt);
  });

  it('deleteTemplate removes the template', async () => {
    const created = await createTemplate(client, { name: 'Delete me' });
    await deleteTemplate(client, created.id);
    const result = await getTemplate(client, created.id);
    assert.strictEqual(result, null);
  });

  it('listTemplates returns all templates', async () => {
    const t1 = await createTemplate(client, { name: 'List 1' });
    const t2 = await createTemplate(client, { name: 'List 2' });

    const templates = await listTemplates(client);
    const ids = templates.map((t) => t.id);

    assert.ok(ids.includes(t1.id));
    assert.ok(ids.includes(t2.id));
    assert.ok(templates.length >= 2);
  });

  it('instantiateTemplate creates tasks with correct date offsets', async () => {
    const template = await createTemplate(client, {
      name: 'Release template',
      taskDefinitions: [
        { refId: 'prep', description: 'Prepare release', offsetDays: -2 },
        { refId: 'release', description: 'Release day', offsetDays: 0 },
        { refId: 'followup', description: 'Follow up', offsetDays: 3 },
      ],
    });

    const bundleId = 'release-bundle-1';
    const anchorDate = '2026-03-10';

    const tasks = await instantiateTemplate(client, template.id, bundleId, anchorDate);

    assert.strictEqual(tasks.length, 3);

    // Sort by date for predictable assertions
    tasks.sort((a, b) => a.date.localeCompare(b.date));

    // -2 days from 2026-03-10 = 2026-03-08
    assert.strictEqual(tasks[0].date, '2026-03-08');
    assert.strictEqual(tasks[0].description, 'Prepare release');
    assert.strictEqual(tasks[0].bundleId, bundleId);
    assert.strictEqual(tasks[0].source, 'template');
    assert.strictEqual(tasks[0].templateTaskRef, 'prep');
    assert.strictEqual(tasks[0].status, 'todo');

    // 0 days offset = 2026-03-10
    assert.strictEqual(tasks[1].date, '2026-03-10');
    assert.strictEqual(tasks[1].description, 'Release day');
    assert.strictEqual(tasks[1].templateTaskRef, 'release');

    // +3 days from 2026-03-10 = 2026-03-13
    assert.strictEqual(tasks[2].date, '2026-03-13');
    assert.strictEqual(tasks[2].description, 'Follow up');
    assert.strictEqual(tasks[2].templateTaskRef, 'followup');

    // Verify each task is actually persisted
    for (const task of tasks) {
      const fetched = await getTask(client, task.id);
      assert.ok(fetched, `Task ${task.id} should be persisted`);
      assert.strictEqual(fetched.description, task.description);
    }
  });

  it('instantiateTemplate throws for non-existent template', async () => {
    await assert.rejects(
      () => instantiateTemplate(client, 'no-such-template', 'bundle-1', '2026-01-01'),
      { message: 'Template not found: no-such-template' }
    );
  });
});
