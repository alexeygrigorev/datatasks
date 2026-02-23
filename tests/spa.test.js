const { describe, it, after } = require('node:test');
const assert = require('node:assert');
const { handler } = require('../src/handler');
const { stopLocal } = require('../src/db/client');

describe('SPA shell and static files', () => {
  after(async () => {
    await stopLocal();
  });

  it('GET / returns HTML containing nav links and script tags', async () => {
    const event = { httpMethod: 'GET', path: '/' };
    const result = await handler(event, {});

    assert.strictEqual(result.statusCode, 200);
    assert.strictEqual(result.headers['Content-Type'], 'text/html');

    // Nav links
    assert.ok(result.body.includes('href="#/tasks"'), 'should have Tasks nav link');
    assert.ok(result.body.includes('href="#/projects"'), 'should have Projects nav link');
    assert.ok(result.body.includes('href="#/templates"'), 'should have Templates nav link');

    // Script tags
    assert.ok(result.body.includes('<script src="/public/api.js"></script>'), 'should load api.js');
    assert.ok(result.body.includes('<script src="/public/app.js"></script>'), 'should load app.js');

    // App container
    assert.ok(result.body.includes('<div id="app"></div>'), 'should have app container');
  });

  it('GET /public/app.js returns JavaScript', async () => {
    const event = { httpMethod: 'GET', path: '/public/app.js' };
    const result = await handler(event, {});

    assert.strictEqual(result.statusCode, 200);
    assert.strictEqual(result.headers['Content-Type'], 'application/javascript');
    assert.ok(result.body.length > 0, 'body should not be empty');
    assert.ok(result.body.includes('hashchange'), 'app.js should contain router code');
  });

  it('GET /public/api.js returns JavaScript', async () => {
    const event = { httpMethod: 'GET', path: '/public/api.js' };
    const result = await handler(event, {});

    assert.strictEqual(result.statusCode, 200);
    assert.strictEqual(result.headers['Content-Type'], 'application/javascript');
    assert.ok(result.body.length > 0, 'body should not be empty');
    assert.ok(result.body.includes('window.api'), 'api.js should define window.api');
  });

  it('GET /public/../secret returns 404 (path traversal blocked)', async () => {
    const event = { httpMethod: 'GET', path: '/public/../secret' };
    const result = await handler(event, {});

    assert.strictEqual(result.statusCode, 404);
  });

  it('GET /public/nonexistent.js returns 404', async () => {
    const event = { httpMethod: 'GET', path: '/public/nonexistent.js' };
    const result = await handler(event, {});

    assert.strictEqual(result.statusCode, 404);
  });

  it('GET /public/evil.html returns 404 (non-JS file rejected)', async () => {
    const event = { httpMethod: 'GET', path: '/public/evil.html' };
    const result = await handler(event, {});

    assert.strictEqual(result.statusCode, 404);
  });
});
