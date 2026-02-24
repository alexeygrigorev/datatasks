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
      type: 'sprint',
    });

    await new Promise((r) => setTimeout(r, 10));

    const updated = await updateTemplate(client, created.id, {
      name: 'Updated',
    });

    assert.strictEqual(updated!.name, 'Updated');
    assert.strictEqual(updated!.type, 'sprint');
    assert.ok(updated!.updatedAt > created.updatedAt);
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

  // --- New fields tests (issue #17) ---

  it('createTemplate persists all new template-level fields', async () => {
    const template = await createTemplate(client, {
      name: 'Newsletter',
      type: 'newsletter',
      emoji: '\u{1F4F0}',
      tags: ['newsletter', 'weekly'],
      defaultAssigneeId: 'user-grace',
      references: [{ name: 'Style guide', url: 'https://docs.google.com/style' }],
      bundleLinkDefinitions: [{ name: 'Luma' }, { name: 'YouTube' }],
      triggerType: 'automatic',
      triggerSchedule: '0 9 * * 1',
      triggerLeadDays: 14,
      taskDefinitions: [
        { refId: 'draft', description: 'Write draft', offsetDays: -7 },
      ],
    });

    assert.ok(template.id);
    assert.strictEqual(template.emoji, '\u{1F4F0}');
    assert.deepStrictEqual(template.tags, ['newsletter', 'weekly']);
    assert.strictEqual(template.defaultAssigneeId, 'user-grace');
    assert.deepStrictEqual(template.references, [{ name: 'Style guide', url: 'https://docs.google.com/style' }]);
    assert.deepStrictEqual(template.bundleLinkDefinitions, [{ name: 'Luma' }, { name: 'YouTube' }]);
    assert.strictEqual(template.triggerType, 'automatic');
    assert.strictEqual(template.triggerSchedule, '0 9 * * 1');
    assert.strictEqual(template.triggerLeadDays, 14);

    // Verify persisted via getTemplate
    const fetched = await getTemplate(client, template.id);
    assert.ok(fetched);
    assert.strictEqual(fetched.emoji, '\u{1F4F0}');
    assert.deepStrictEqual(fetched.tags, ['newsletter', 'weekly']);
    assert.strictEqual(fetched.defaultAssigneeId, 'user-grace');
    assert.strictEqual(fetched.triggerType, 'automatic');
    assert.strictEqual(fetched.triggerSchedule, '0 9 * * 1');
    assert.strictEqual(fetched.triggerLeadDays, 14);
  });

  it('createTemplate persists enriched task definitions with new fields', async () => {
    const template = await createTemplate(client, {
      name: 'Event template',
      type: 'webinar',
      taskDefinitions: [
        {
          refId: 'announce',
          description: 'Announce event',
          offsetDays: -7,
          isMilestone: false,
          assigneeId: 'user-valeriia',
          instructionsUrl: 'https://docs.google.com/announce',
          requiredLinkName: 'Luma',
          requiresFile: false,
        },
        {
          refId: 'stream',
          description: 'Actual stream',
          offsetDays: 0,
          isMilestone: true,
          stageOnComplete: 'after-event',
        },
      ],
    });

    assert.ok(template.taskDefinitions);
    assert.strictEqual(template.taskDefinitions.length, 2);

    const td0 = template.taskDefinitions[0] as Record<string, unknown>;
    assert.strictEqual(td0.isMilestone, false);
    assert.strictEqual(td0.assigneeId, 'user-valeriia');
    assert.strictEqual(td0.instructionsUrl, 'https://docs.google.com/announce');
    assert.strictEqual(td0.requiredLinkName, 'Luma');
    assert.strictEqual(td0.requiresFile, false);

    const td1 = template.taskDefinitions[1] as Record<string, unknown>;
    assert.strictEqual(td1.isMilestone, true);
    assert.strictEqual(td1.stageOnComplete, 'after-event');
  });

  it('updateTemplate can add new template-level fields', async () => {
    const created = await createTemplate(client, {
      name: 'Basic',
      type: 'test',
      taskDefinitions: [
        { refId: 'a', description: 'Task A', offsetDays: 0 },
      ],
    });

    await new Promise((r) => setTimeout(r, 10));

    const updated = await updateTemplate(client, created.id, {
      emoji: '\u{1F399}\u{FE0F}',
      tags: ['podcast', 'content'],
      references: [{ name: 'Recording guide', url: 'https://docs.google.com/rec' }],
      triggerType: 'automatic',
      triggerSchedule: '0 9 * * 1',
      triggerLeadDays: 14,
    });

    assert.ok(updated);
    assert.strictEqual(updated.emoji, '\u{1F399}\u{FE0F}');
    assert.deepStrictEqual(updated.tags, ['podcast', 'content']);
    assert.deepStrictEqual(updated.references, [{ name: 'Recording guide', url: 'https://docs.google.com/rec' }]);
    assert.strictEqual(updated.triggerType, 'automatic');
    assert.strictEqual(updated.triggerSchedule, '0 9 * * 1');
    assert.strictEqual(updated.triggerLeadDays, 14);
    // Original fields preserved
    assert.strictEqual(updated.name, 'Basic');
    assert.strictEqual(updated.type, 'test');
  });

  it('template without new fields works (backward compatibility)', async () => {
    const template = await createTemplate(client, {
      name: 'Minimal',
      type: 'test',
      taskDefinitions: [
        { refId: 'a', description: 'Task A', offsetDays: 0 },
      ],
    });

    const fetched = await getTemplate(client, template.id);
    assert.ok(fetched);
    assert.strictEqual(fetched.name, 'Minimal');
    assert.strictEqual(fetched.type, 'test');
    // New optional fields should be absent
    assert.strictEqual(fetched.emoji, undefined);
    assert.strictEqual(fetched.tags, undefined);
    assert.strictEqual(fetched.defaultAssigneeId, undefined);
    assert.strictEqual(fetched.references, undefined);
    assert.strictEqual(fetched.bundleLinkDefinitions, undefined);
    assert.strictEqual(fetched.triggerType, undefined);
    assert.strictEqual(fetched.triggerSchedule, undefined);
    assert.strictEqual(fetched.triggerLeadDays, undefined);
  });
});
