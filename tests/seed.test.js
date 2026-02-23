const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');

const { startLocal, stopLocal, getClient } = require('../src/db/client');
const { createTables } = require('../src/db/setup');
const { listTemplates } = require('../src/db/templates');
const { seed, DEFAULT_TEMPLATES } = require('../scripts/seed-templates');

describe('Seed script', () => {
  let client;

  before(async () => {
    const port = await startLocal();
    client = await getClient(port);
    await createTables(client);
  });

  after(async () => {
    await stopLocal();
  });

  it('creates 3 default templates when none exist', async () => {
    // Verify no templates exist yet
    const before = await listTemplates(client);
    assert.strictEqual(before.length, 0);

    await seed();

    const after = await listTemplates(client);
    assert.strictEqual(after.length, 3);

    // Verify template names
    const names = after.map((t) => t.name).sort();
    assert.deepStrictEqual(names, ['Course', 'Event', 'Newsletter']);

    // Verify task definition counts
    const newsletter = after.find((t) => t.type === 'newsletter');
    assert.strictEqual(newsletter.taskDefinitions.length, 7);

    const course = after.find((t) => t.type === 'course');
    assert.strictEqual(course.taskDefinitions.length, 10);

    const event = after.find((t) => t.type === 'event');
    assert.strictEqual(event.taskDefinitions.length, 9);
  });

  it('is idempotent — running seed twice does not duplicate templates', async () => {
    // Templates were created by the previous test
    const beforeSecondRun = await listTemplates(client);
    const countBefore = beforeSecondRun.length;
    assert.ok(countBefore > 0, 'Templates should already exist from previous test');

    // Run seed again
    await seed();

    const afterSecondRun = await listTemplates(client);
    assert.strictEqual(afterSecondRun.length, countBefore, 'Template count should not change after second seed');
  });
});
