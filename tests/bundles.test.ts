import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

import { startLocal, stopLocal, getClient } from '../src/db/client';
import { createTables, deleteTables } from '../src/db/setup';
import {
  createBundle,
  getBundle,
  updateBundle,
  deleteBundle,
  listBundles,
} from '../src/db/bundles';

describe('Bundles data layer', () => {
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

  it('createBundle returns a bundle with id, createdAt, updatedAt', async () => {
    const bundle = await createBundle(client, {
      name: 'DataTasks v2',
      description: 'Next version of the app',
    });

    assert.ok(bundle.id);
    assert.ok(bundle.createdAt);
    assert.ok(bundle.updatedAt);
    assert.strictEqual(bundle.name, 'DataTasks v2');
    assert.strictEqual(bundle.description, 'Next version of the app');
    assert.strictEqual((bundle as Record<string, unknown>).PK, undefined);
    assert.strictEqual((bundle as Record<string, unknown>).SK, undefined);
  });

  it('getBundle returns the bundle by id', async () => {
    const created = await createBundle(client, { name: 'Fetch bundle' });
    const fetched = await getBundle(client, created.id);

    assert.ok(fetched);
    assert.strictEqual(fetched.id, created.id);
    assert.strictEqual(fetched.name, 'Fetch bundle');
  });

  it('getBundle returns null for non-existent id', async () => {
    const result = await getBundle(client, 'does-not-exist');
    assert.strictEqual(result, null);
  });

  it('updateBundle performs partial update and refreshes updatedAt', async () => {
    const created = await createBundle(client, {
      name: 'Original name',
      status: 'active',
    });

    await new Promise((r) => setTimeout(r, 10));

    const updated = await updateBundle(client, created.id, {
      name: 'New name',
    });

    assert.strictEqual(updated.name, 'New name');
    assert.strictEqual(updated.status, 'active');
    assert.ok(updated.updatedAt > created.updatedAt);
  });

  it('deleteBundle removes the bundle', async () => {
    const created = await createBundle(client, { name: 'Delete me' });
    await deleteBundle(client, created.id);
    const result = await getBundle(client, created.id);
    assert.strictEqual(result, null);
  });

  it('listBundles returns all bundles', async () => {
    const b1 = await createBundle(client, { name: 'List test 1' });
    const b2 = await createBundle(client, { name: 'List test 2' });

    const bundles = await listBundles(client);
    const ids = bundles.map((b) => b.id);

    assert.ok(ids.includes(b1.id), 'should contain first bundle');
    assert.ok(ids.includes(b2.id), 'should contain second bundle');
    assert.ok(bundles.length >= 2, 'should have at least 2 bundles');
  });
});
