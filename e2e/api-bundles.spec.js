const { test, expect } = require('@playwright/test');

// Helper: UUID v4 pattern
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Helper: ISO-8601 timestamp pattern
const ISO_TS_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/;

test.describe('Bundle CRUD API', () => {
  // ──────────────────────────────────────────────────────────────────
  // POST /api/bundles — Create
  // ──────────────────────────────────────────────────────────────────

  test.describe('POST /api/bundles', () => {
    test('creates a bundle with required fields only (title + anchorDate)', async ({ request }) => {
      const res = await request.post('/api/bundles', {
        data: { title: 'ML Zoomcamp 2026', anchorDate: '2026-06-01' },
      });
      expect(res.status()).toBe(201);

      const body = await res.json();
      expect(body.bundle).toBeDefined();
      expect(body.bundle.id).toMatch(UUID_RE);
      expect(body.bundle.title).toBe('ML Zoomcamp 2026');
      expect(body.bundle.anchorDate).toBe('2026-06-01');
      expect(body.bundle.createdAt).toMatch(ISO_TS_RE);
      expect(body.bundle.updatedAt).toMatch(ISO_TS_RE);

      // No tasks key when no templateId provided
      expect(body.tasks).toBeUndefined();
    });

    test('creates a bundle with optional description', async ({ request }) => {
      const res = await request.post('/api/bundles', {
        data: {
          title: 'Newsletter',
          anchorDate: '2026-03-01',
          description: 'Weekly newsletter',
        },
      });
      expect(res.status()).toBe(201);

      const body = await res.json();
      expect(body.bundle.description).toBe('Weekly newsletter');
      expect(body.bundle.title).toBe('Newsletter');
      expect(body.bundle.anchorDate).toBe('2026-03-01');
    });

    test('returns 400 when title is missing', async ({ request }) => {
      const res = await request.post('/api/bundles', {
        data: { anchorDate: '2026-06-01' },
      });
      expect(res.status()).toBe(400);

      const body = await res.json();
      expect(body.error).toBeDefined();
      expect(body.error.toLowerCase()).toContain('title');
    });

    test('returns 400 when anchorDate is missing', async ({ request }) => {
      const res = await request.post('/api/bundles', {
        data: { title: 'Test' },
      });
      expect(res.status()).toBe(400);

      const body = await res.json();
      expect(body.error).toBeDefined();
      expect(body.error.toLowerCase()).toContain('anchordate');
    });

    test('returns 400 for invalid anchorDate format', async ({ request }) => {
      const res = await request.post('/api/bundles', {
        data: { title: 'Bad date', anchorDate: '06-01-2026' },
      });
      expect(res.status()).toBe(400);

      const body = await res.json();
      expect(body.error).toBeDefined();
    });

    test('returns 400 for empty title string', async ({ request }) => {
      const res = await request.post('/api/bundles', {
        data: { title: '   ', anchorDate: '2026-06-01' },
      });
      expect(res.status()).toBe(400);

      const body = await res.json();
      expect(body.error).toBeDefined();
      expect(body.error.toLowerCase()).toContain('title');
    });

    test('returns 201 and Content-Type application/json', async ({ request }) => {
      const res = await request.post('/api/bundles', {
        data: { title: 'Content-Type test', anchorDate: '2026-07-01' },
      });
      expect(res.status()).toBe(201);
      expect(res.headers()['content-type']).toBe('application/json');
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // GET /api/bundles — List all
  // ──────────────────────────────────────────────────────────────────

  test.describe('GET /api/bundles', () => {
    test('lists all bundles as an array', async ({ request }) => {
      // Ensure at least one bundle exists
      await request.post('/api/bundles', {
        data: { title: 'List test', anchorDate: '2026-07-01' },
      });

      const res = await request.get('/api/bundles');
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.bundles).toBeInstanceOf(Array);
      expect(body.bundles.length).toBeGreaterThan(0);
    });

    test('returns Content-Type application/json', async ({ request }) => {
      const res = await request.get('/api/bundles');
      expect(res.status()).toBe(200);
      expect(res.headers()['content-type']).toBe('application/json');
    });

    test('each bundle in the list has expected fields', async ({ request }) => {
      await request.post('/api/bundles', {
        data: { title: 'Fields check', anchorDate: '2026-08-01' },
      });

      const res = await request.get('/api/bundles');
      const body = await res.json();

      const bundle = body.bundles.find((b) => b.title === 'Fields check');
      expect(bundle).toBeDefined();
      expect(bundle.id).toMatch(UUID_RE);
      expect(bundle.anchorDate).toBe('2026-08-01');
      expect(bundle.createdAt).toBeTruthy();
      expect(bundle.updatedAt).toBeTruthy();
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // GET /api/bundles/:id — Single bundle
  // ──────────────────────────────────────────────────────────────────

  test.describe('GET /api/bundles/:id', () => {
    test('returns the bundle when it exists', async ({ request }) => {
      const create = await request.post('/api/bundles', {
        data: { title: 'Fetch me', anchorDate: '2026-07-01', description: 'desc' },
      });
      const { bundle } = await create.json();

      const res = await request.get(`/api/bundles/${bundle.id}`);
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.bundle.id).toBe(bundle.id);
      expect(body.bundle.title).toBe('Fetch me');
      expect(body.bundle.description).toBe('desc');
      expect(body.bundle.anchorDate).toBe('2026-07-01');
    });

    test('returns 404 for a non-existent bundle', async ({ request }) => {
      const res = await request.get('/api/bundles/does-not-exist');
      expect(res.status()).toBe(404);

      const body = await res.json();
      expect(body.error).toBe('Bundle not found');
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // PUT /api/bundles/:id — Update
  // ──────────────────────────────────────────────────────────────────

  test.describe('PUT /api/bundles/:id', () => {
    test('updates the title of an existing bundle', async ({ request }) => {
      const create = await request.post('/api/bundles', {
        data: { title: 'Old Title', anchorDate: '2026-07-01' },
      });
      const { bundle: original } = await create.json();

      const res = await request.put(`/api/bundles/${original.id}`, {
        data: { title: 'New Title' },
      });
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.bundle.title).toBe('New Title');
      expect(body.bundle.id).toBe(original.id);
    });

    test('updates the description', async ({ request }) => {
      const create = await request.post('/api/bundles', {
        data: { title: 'Desc bundle', anchorDate: '2026-07-01', description: 'original' },
      });
      const { bundle } = await create.json();

      const res = await request.put(`/api/bundles/${bundle.id}`, {
        data: { description: 'updated description' },
      });
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.bundle.description).toBe('updated description');
    });

    test('updates the anchorDate', async ({ request }) => {
      const create = await request.post('/api/bundles', {
        data: { title: 'Date bundle', anchorDate: '2026-07-01' },
      });
      const { bundle } = await create.json();

      const res = await request.put(`/api/bundles/${bundle.id}`, {
        data: { anchorDate: '2026-08-15' },
      });
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.bundle.anchorDate).toBe('2026-08-15');
    });

    test('updatedAt changes after an update', async ({ request }) => {
      const create = await request.post('/api/bundles', {
        data: { title: 'Timestamp bundle', anchorDate: '2026-07-01' },
      });
      const { bundle: original } = await create.json();

      // Small delay so timestamps differ
      await new Promise((r) => setTimeout(r, 50));

      const res = await request.put(`/api/bundles/${original.id}`, {
        data: { title: 'Updated timestamp' },
      });
      const { bundle: updated } = await res.json();

      expect(updated.updatedAt).not.toBe(original.updatedAt);
    });

    test('returns 404 for a non-existent bundle', async ({ request }) => {
      const res = await request.put('/api/bundles/does-not-exist', {
        data: { title: 'New' },
      });
      expect(res.status()).toBe(404);

      const body = await res.json();
      expect(body.error).toBe('Bundle not found');
    });

    test('returns 400 when body has no valid fields', async ({ request }) => {
      const create = await request.post('/api/bundles', {
        data: { title: 'No valid fields', anchorDate: '2026-07-01' },
      });
      const { bundle } = await create.json();

      const res = await request.put(`/api/bundles/${bundle.id}`, {
        data: { unknownField: 'value' },
      });
      expect(res.status()).toBe(400);
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // DELETE /api/bundles/:id — Delete
  // ──────────────────────────────────────────────────────────────────

  test.describe('DELETE /api/bundles/:id', () => {
    test('deletes an existing bundle and returns 204', async ({ request }) => {
      const create = await request.post('/api/bundles', {
        data: { title: 'Delete me', anchorDate: '2026-07-01' },
      });
      const { bundle } = await create.json();

      const del = await request.delete(`/api/bundles/${bundle.id}`);
      expect(del.status()).toBe(204);

      // Verify the response body is empty
      const text = await del.text();
      expect(text).toBe('');
    });

    test('deleted bundle is no longer retrievable', async ({ request }) => {
      const create = await request.post('/api/bundles', {
        data: { title: 'Delete and verify', anchorDate: '2026-07-01' },
      });
      const { bundle } = await create.json();

      await request.delete(`/api/bundles/${bundle.id}`);

      const get = await request.get(`/api/bundles/${bundle.id}`);
      expect(get.status()).toBe(404);
    });

    test('returns 404 for a non-existent bundle', async ({ request }) => {
      const res = await request.delete('/api/bundles/does-not-exist');
      expect(res.status()).toBe(404);

      const body = await res.json();
      expect(body.error).toBe('Bundle not found');
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // GET /api/bundles/:id/tasks — Bundle tasks
  // ──────────────────────────────────────────────────────────────────

  test.describe('GET /api/bundles/:id/tasks', () => {
    test('returns an empty tasks array for a bundle with no tasks', async ({ request }) => {
      const create = await request.post('/api/bundles', {
        data: { title: 'No tasks bundle', anchorDate: '2026-07-01' },
      });
      const { bundle } = await create.json();

      const res = await request.get(`/api/bundles/${bundle.id}/tasks`);
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.tasks).toBeInstanceOf(Array);
      expect(body.tasks).toHaveLength(0);
    });

    test('returns tasks that belong to the bundle', async ({ request }) => {
      // Create a template with 2 tasks
      const tmplRes = await request.post('/api/templates', {
        data: {
          name: 'Tasks test', type: 'test',
          taskDefinitions: [
            { refId: 'a1', description: 'Task A', offsetDays: 0 },
            { refId: 'a2', description: 'Task B', offsetDays: 1 },
          ],
        },
      });
      const { template } = await tmplRes.json();

      // Create bundle with that template to generate tasks
      const create = await request.post('/api/bundles', {
        data: { title: 'Has tasks', anchorDate: '2026-05-01', templateId: template.id },
      });
      const { bundle } = await create.json();

      const res = await request.get(`/api/bundles/${bundle.id}/tasks`);
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.tasks).toHaveLength(2);
      expect(body.tasks.every((t) => t.bundleId === bundle.id)).toBe(true);
    });

    test('returns 404 for a non-existent bundle', async ({ request }) => {
      const res = await request.get('/api/bundles/does-not-exist/tasks');
      expect(res.status()).toBe(404);

      const body = await res.json();
      expect(body.error).toBe('Bundle not found');
    });
  });
});

// ──────────────────────────────────────────────────────────────────
// Bundle with template
// ──────────────────────────────────────────────────────────────────

test.describe('Bundle with template', () => {
  test('creates bundle from template and generates tasks with correct dates', async ({ request }) => {
    // Create template with offsets -7, 0, +3
    const tmplRes = await request.post('/api/templates', {
      data: {
        name: 'E2E Event', type: 'event',
        taskDefinitions: [
          { refId: 't1', description: 'Prepare', offsetDays: -7 },
          { refId: 't2', description: 'Run event', offsetDays: 0 },
          { refId: 't3', description: 'Follow up', offsetDays: 3 },
        ],
      },
    });
    const { template } = await tmplRes.json();

    // Create bundle with anchorDate 2026-04-15
    const res = await request.post('/api/bundles', {
      data: {
        title: 'Community Meetup',
        anchorDate: '2026-04-15',
        templateId: template.id,
      },
    });
    expect(res.status()).toBe(201);

    const body = await res.json();

    // Verify bundle
    expect(body.bundle).toBeDefined();
    expect(body.bundle.id).toMatch(UUID_RE);
    expect(body.bundle.title).toBe('Community Meetup');
    expect(body.bundle.templateId).toBe(template.id);

    // Verify tasks array is returned
    expect(body.tasks).toBeDefined();
    expect(body.tasks).toHaveLength(3);

    // Verify task dates: anchor 2026-04-15 with offsets -7, 0, +3
    const dates = body.tasks.map((t) => t.date).sort();
    expect(dates).toEqual(['2026-04-08', '2026-04-15', '2026-04-18']);
  });

  test('template tasks have source "template" and correct bundleId', async ({ request }) => {
    const tmplRes = await request.post('/api/templates', {
      data: {
        name: 'Source check template', type: 'test',
        taskDefinitions: [
          { refId: 's1', description: 'Task 1', offsetDays: 0 },
          { refId: 's2', description: 'Task 2', offsetDays: 5 },
        ],
      },
    });
    const { template } = await tmplRes.json();

    const res = await request.post('/api/bundles', {
      data: {
        title: 'Source check bundle',
        anchorDate: '2026-05-01',
        templateId: template.id,
      },
    });
    const body = await res.json();

    expect(body.tasks).toHaveLength(2);
    for (const task of body.tasks) {
      expect(task.source).toBe('template');
      expect(task.bundleId).toBe(body.bundle.id);
    }
  });

  test('template tasks are retrievable via GET /api/bundles/:id/tasks', async ({ request }) => {
    const tmplRes = await request.post('/api/templates', {
      data: {
        name: 'Retrieve template', type: 'test',
        taskDefinitions: [
          { refId: 'r1', description: 'Book venue', offsetDays: -14 },
          { refId: 'r2', description: 'Send invites', offsetDays: -7 },
          { refId: 'r3', description: 'Run event', offsetDays: 0 },
        ],
      },
    });
    const { template } = await tmplRes.json();

    const createRes = await request.post('/api/bundles', {
      data: {
        title: 'Conference',
        anchorDate: '2026-04-15',
        templateId: template.id,
      },
    });
    const { bundle, tasks: createdTasks } = await createRes.json();

    // Verify via the sub-route
    const tasksRes = await request.get(`/api/bundles/${bundle.id}/tasks`);
    expect(tasksRes.status()).toBe(200);

    const tasksBody = await tasksRes.json();
    expect(tasksBody.tasks).toHaveLength(3);
    expect(tasksBody.tasks.every((t) => t.source === 'template')).toBe(true);
    expect(tasksBody.tasks.every((t) => t.bundleId === bundle.id)).toBe(true);

    // Verify dates match what was returned at creation
    const fetchedDates = tasksBody.tasks.map((t) => t.date).sort();
    const createdDates = createdTasks.map((t) => t.date).sort();
    expect(fetchedDates).toEqual(createdDates);
  });

  test('template tasks have correct templateTaskRef from refId', async ({ request }) => {
    const tmplRes = await request.post('/api/templates', {
      data: {
        name: 'RefId template', type: 'test',
        taskDefinitions: [
          { refId: 'ref-alpha', description: 'Alpha task', offsetDays: -3 },
          { refId: 'ref-beta', description: 'Beta task', offsetDays: 0 },
        ],
      },
    });
    const { template } = await tmplRes.json();

    const res = await request.post('/api/bundles', {
      data: {
        title: 'RefId bundle',
        anchorDate: '2026-06-10',
        templateId: template.id,
      },
    });
    const body = await res.json();

    const refs = body.tasks.map((t) => t.templateTaskRef).sort();
    expect(refs).toEqual(['ref-alpha', 'ref-beta']);
  });

  test('returns 404 when templateId does not exist', async ({ request }) => {
    const res = await request.post('/api/bundles', {
      data: {
        title: 'Bad template',
        anchorDate: '2026-01-01',
        templateId: 'nonexistent-template-id',
      },
    });
    expect(res.status()).toBe(404);

    const body = await res.json();
    expect(body.error).toBe('Template not found');
  });

  test('no bundle is created when templateId does not exist', async ({ request }) => {
    // Get current bundle count
    const before = await request.get('/api/bundles');
    const beforeBody = await before.json();
    const countBefore = beforeBody.bundles.length;

    // Attempt to create with bad template
    await request.post('/api/bundles', {
      data: {
        title: 'Should not exist',
        anchorDate: '2026-01-01',
        templateId: 'nonexistent-template-id',
      },
    });

    // Verify bundle count has not increased
    const after = await request.get('/api/bundles');
    const afterBody = await after.json();
    const countAfter = afterBody.bundles.length;
    expect(countAfter).toBe(countBefore);
  });
});

// ──────────────────────────────────────────────────────────────────
// Old /api/projects endpoints return 404
// ──────────────────────────────────────────────────────────────────

test.describe('Old project endpoints return 404', () => {
  test('GET /api/projects returns 404', async ({ request }) => {
    const res = await request.get('/api/projects');
    expect(res.status()).toBe(404);
  });
});

// ──────────────────────────────────────────────────────────────────
// Tasks filtered by bundleId
// ──────────────────────────────────────────────────────────────────

test.describe('Tasks filtered by bundleId', () => {
  test('GET /api/tasks?bundleId returns tasks for that bundle', async ({ request }) => {
    // Create a bundle with template tasks
    const tmplRes = await request.post('/api/templates', {
      data: {
        name: 'Filter test template', type: 'test',
        taskDefinitions: [
          { refId: 'f1', description: 'Filter task 1', offsetDays: 0 },
          { refId: 'f2', description: 'Filter task 2', offsetDays: 1 },
        ],
      },
    });
    const { template } = await tmplRes.json();

    const createRes = await request.post('/api/bundles', {
      data: {
        title: 'Filter bundle',
        anchorDate: '2026-09-01',
        templateId: template.id,
      },
    });
    const { bundle } = await createRes.json();

    const res = await request.get(`/api/tasks?bundleId=${bundle.id}`);
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.tasks.length).toBe(2);
    for (const task of body.tasks) {
      expect(task.bundleId).toBe(bundle.id);
    }
  });
});

// ──────────────────────────────────────────────────────────────────
// Frontend navigation
// ──────────────────────────────────────────────────────────────────

test.describe('Frontend bundles page', () => {
  test('navigating to #/bundles shows Bundles heading and New Bundle form', async ({ page }) => {
    await page.goto('/#/bundles');
    await page.waitForSelector('h2');

    const heading = await page.textContent('h2');
    expect(heading).toBe('Bundles');

    const formHeading = await page.textContent('.form-section h3');
    expect(formHeading).toBe('New Bundle');

    // Verify the form fields are present
    await expect(page.locator('#bundle-title')).toBeVisible();
    await expect(page.locator('#bundle-anchor')).toBeVisible();
    await expect(page.locator('#bundle-create-btn')).toBeVisible();
  });

  test('nav bar shows Bundles link (not Projects)', async ({ page }) => {
    await page.goto('/');
    // Wait for page to load
    await page.waitForSelector('nav');

    const navText = await page.textContent('nav');
    expect(navText).toContain('Bundles');
    expect(navText).not.toContain('Projects');

    // Verify the link href
    const bundleLink = page.locator('nav a[href="#/bundles"]');
    await expect(bundleLink).toBeVisible();
  });

  test('empty state shows "No bundles yet" message', async ({ page, request }) => {
    // Delete all existing bundles first
    const listRes = await request.get('/api/bundles');
    const { bundles } = await listRes.json();
    for (const b of bundles) {
      await request.delete(`/api/bundles/${b.id}`);
    }

    await page.goto('/#/bundles');
    await page.waitForSelector('.empty-state');

    const emptyText = await page.textContent('.empty-state');
    expect(emptyText).toContain('No bundles yet. Create one to get started.');
  });

  test('creating a bundle from the frontend form works', async ({ page }) => {
    await page.goto('/#/bundles');
    await page.waitForSelector('#bundle-title');

    await page.fill('#bundle-title', 'Test Bundle');
    await page.fill('#bundle-anchor', '2026-07-01');
    await page.click('#bundle-create-btn');

    // Wait for the bundle card to appear
    await page.waitForSelector('.bundle-card-title');

    const titles = await page.locator('.bundle-card-title').allTextContents();
    expect(titles).toContain('Test Bundle');
  });
});

// ──────────────────────────────────────────────────────────────────
// Existing routes
// ──────────────────────────────────────────────────────────────────

test.describe('Existing routes', () => {
  test('GET /api/health returns 200 with status ok', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.status).toBe('ok');
  });

  test('GET / returns 200 with text/html Content-Type', async ({ request }) => {
    const res = await request.get('/');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('text/html');
  });
});
