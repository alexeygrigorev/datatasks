import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

import { startLocal, stopLocal, getClient } from '../src/db/client';
import { createTables } from '../src/db/setup';
import { listTemplates } from '../src/db/templates';
import { seed, DEFAULT_TEMPLATES } from '../scripts/seed-templates';

describe('Seed script', () => {
  let client: DynamoDBDocumentClient;

  before(async () => {
    const port = await startLocal();
    client = await getClient(port);
    await createTables(client);
  });

  after(async () => {
    await stopLocal();
  });

  it('creates 3 default templates when none exist', async () => {
    const before = await listTemplates(client);
    assert.strictEqual(before.length, 0);

    await seed();

    const after = await listTemplates(client);
    assert.strictEqual(after.length, 3);

    const names = after.map((t) => t.name).sort();
    assert.deepStrictEqual(names, ['Course', 'Event', 'Newsletter']);

    const newsletter = after.find((t) => t.type === 'newsletter');
    assert.strictEqual(newsletter!.taskDefinitions!.length, 7);

    const course = after.find((t) => t.type === 'course');
    assert.strictEqual(course!.taskDefinitions!.length, 10);

    const event = after.find((t) => t.type === 'event');
    assert.strictEqual(event!.taskDefinitions!.length, 9);
  });

  it('is idempotent — running seed twice does not duplicate templates', async () => {
    const beforeSecondRun = await listTemplates(client);
    const countBefore = beforeSecondRun.length;
    assert.ok(countBefore > 0, 'Templates should already exist from previous test');

    await seed();

    const afterSecondRun = await listTemplates(client);
    assert.strictEqual(afterSecondRun.length, countBefore, 'Template count should not change after second seed');
  });
});
