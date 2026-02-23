const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');

const { startLocal, stopLocal, getClient } = require('../src/db/client');
const { createTables, deleteTables } = require('../src/db/setup');
const {
  createTask,
  getTask,
  updateTask,
  deleteTask,
  listTasksByDate,
  listTasksByDateRange,
  listTasksByProject,
  listTasksByStatus,
} = require('../src/db/tasks');

describe('Tasks data layer', () => {
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

  it('createTask returns a task with id, createdAt, updatedAt', async () => {
    const task = await createTask(client, {
      description: 'Write unit tests',
      date: '2026-02-23',
      projectId: 'proj-1',
    });

    assert.ok(task.id, 'task should have an id');
    assert.ok(task.createdAt, 'task should have createdAt');
    assert.ok(task.updatedAt, 'task should have updatedAt');
    assert.strictEqual(task.description, 'Write unit tests');
    assert.strictEqual(task.date, '2026-02-23');
    assert.strictEqual(task.projectId, 'proj-1');
    assert.strictEqual(task.status, 'todo');
    // PK/SK should be stripped
    assert.strictEqual(task.PK, undefined);
    assert.strictEqual(task.SK, undefined);
  });

  it('getTask returns the task by id', async () => {
    const created = await createTask(client, {
      description: 'Fetch me',
      date: '2026-02-23',
    });

    const fetched = await getTask(client, created.id);
    assert.ok(fetched);
    assert.strictEqual(fetched.id, created.id);
    assert.strictEqual(fetched.description, 'Fetch me');
  });

  it('getTask returns null for non-existent id', async () => {
    const result = await getTask(client, 'non-existent-id');
    assert.strictEqual(result, null);
  });

  it('updateTask performs partial update and refreshes updatedAt', async () => {
    const created = await createTask(client, {
      description: 'Original',
      date: '2026-02-23',
      status: 'todo',
    });

    // Small delay to ensure updatedAt changes
    await new Promise((r) => setTimeout(r, 10));

    const updated = await updateTask(client, created.id, {
      status: 'done',
      description: 'Updated',
    });

    assert.strictEqual(updated.status, 'done');
    assert.strictEqual(updated.description, 'Updated');
    assert.strictEqual(updated.date, '2026-02-23');
    assert.ok(updated.updatedAt > created.updatedAt, 'updatedAt should be refreshed');
  });

  it('deleteTask removes the task', async () => {
    const created = await createTask(client, {
      description: 'Delete me',
      date: '2026-02-23',
    });

    await deleteTask(client, created.id);
    const result = await getTask(client, created.id);
    assert.strictEqual(result, null);
  });

  it('listTasksByDate returns tasks for a specific date', async () => {
    const uniqueDate = '2099-01-15';
    await createTask(client, { description: 'A', date: uniqueDate, status: 'todo' });
    await createTask(client, { description: 'B', date: uniqueDate, status: 'done' });
    await createTask(client, { description: 'C', date: '2099-01-16', status: 'todo' });

    const tasks = await listTasksByDate(client, uniqueDate);
    assert.strictEqual(tasks.length, 2);
    const descriptions = tasks.map((t) => t.description).sort();
    assert.deepStrictEqual(descriptions, ['A', 'B']);
  });

  it('listTasksByDateRange returns tasks in a date range', async () => {
    const d1 = '2098-06-01';
    const d2 = '2098-06-02';
    const d3 = '2098-06-03';
    const d4 = '2098-06-04';

    await createTask(client, { description: 'R1', date: d1, status: 'todo' });
    await createTask(client, { description: 'R2', date: d2, status: 'todo' });
    await createTask(client, { description: 'R3', date: d3, status: 'todo' });
    await createTask(client, { description: 'R4', date: d4, status: 'todo' });

    const tasks = await listTasksByDateRange(client, d2, d3);
    const descriptions = tasks.map((t) => t.description).sort();
    assert.deepStrictEqual(descriptions, ['R2', 'R3']);
  });

  it('listTasksByProject returns tasks for a given project', async () => {
    const pid = 'project-unique-' + crypto.randomUUID();
    await createTask(client, { description: 'P1', date: '2026-03-01', projectId: pid, status: 'todo' });
    await createTask(client, { description: 'P2', date: '2026-03-02', projectId: pid, status: 'todo' });
    await createTask(client, { description: 'P3', date: '2026-03-01', projectId: 'other', status: 'todo' });

    const tasks = await listTasksByProject(client, pid);
    assert.strictEqual(tasks.length, 2);
    const descriptions = tasks.map((t) => t.description).sort();
    assert.deepStrictEqual(descriptions, ['P1', 'P2']);
  });

  it('listTasksByStatus returns tasks with a given status', async () => {
    const uniqueStatus = 'status-' + crypto.randomUUID();
    await createTask(client, { description: 'S1', date: '2026-04-01', status: uniqueStatus });
    await createTask(client, { description: 'S2', date: '2026-04-02', status: uniqueStatus });
    await createTask(client, { description: 'S3', date: '2026-04-01', status: 'other-status' });

    const tasks = await listTasksByStatus(client, uniqueStatus);
    assert.strictEqual(tasks.length, 2);
    const descriptions = tasks.map((t) => t.description).sort();
    assert.deepStrictEqual(descriptions, ['S1', 'S2']);
  });
});
