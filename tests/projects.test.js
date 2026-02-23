const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');

const { startLocal, stopLocal, getClient } = require('../src/db/client');
const { createTables, deleteTables } = require('../src/db/setup');
const {
  createProject,
  getProject,
  updateProject,
  deleteProject,
  listProjects,
} = require('../src/db/projects');

describe('Projects data layer', () => {
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

  it('createProject returns a project with id, createdAt, updatedAt', async () => {
    const project = await createProject(client, {
      name: 'DataTasks v2',
      description: 'Next version of the app',
    });

    assert.ok(project.id);
    assert.ok(project.createdAt);
    assert.ok(project.updatedAt);
    assert.strictEqual(project.name, 'DataTasks v2');
    assert.strictEqual(project.description, 'Next version of the app');
    assert.strictEqual(project.PK, undefined);
    assert.strictEqual(project.SK, undefined);
  });

  it('getProject returns the project by id', async () => {
    const created = await createProject(client, { name: 'Fetch project' });
    const fetched = await getProject(client, created.id);

    assert.ok(fetched);
    assert.strictEqual(fetched.id, created.id);
    assert.strictEqual(fetched.name, 'Fetch project');
  });

  it('getProject returns null for non-existent id', async () => {
    const result = await getProject(client, 'does-not-exist');
    assert.strictEqual(result, null);
  });

  it('updateProject performs partial update and refreshes updatedAt', async () => {
    const created = await createProject(client, {
      name: 'Original name',
      status: 'active',
    });

    await new Promise((r) => setTimeout(r, 10));

    const updated = await updateProject(client, created.id, {
      name: 'New name',
    });

    assert.strictEqual(updated.name, 'New name');
    assert.strictEqual(updated.status, 'active');
    assert.ok(updated.updatedAt > created.updatedAt);
  });

  it('deleteProject removes the project', async () => {
    const created = await createProject(client, { name: 'Delete me' });
    await deleteProject(client, created.id);
    const result = await getProject(client, created.id);
    assert.strictEqual(result, null);
  });

  it('listProjects returns all projects', async () => {
    // Create tables fresh to get a clean state for this test
    // Instead, we just check that our known projects appear
    const p1 = await createProject(client, { name: 'List test 1' });
    const p2 = await createProject(client, { name: 'List test 2' });

    const projects = await listProjects(client);
    const ids = projects.map((p) => p.id);

    assert.ok(ids.includes(p1.id), 'should contain first project');
    assert.ok(ids.includes(p2.id), 'should contain second project');
    assert.ok(projects.length >= 2, 'should have at least 2 projects');
  });
});
