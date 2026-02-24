const { test, expect } = require('@playwright/test');

// Helper: UUID v4 pattern
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Helper: ISO-8601 timestamp pattern
const ISO_TS_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/;

test.describe('Project CRUD API', () => {
  // ──────────────────────────────────────────────────────────────────
  // POST /api/projects — Create
  // ──────────────────────────────────────────────────────────────────

  test.describe('POST /api/projects', () => {
    test('creates a project with required fields only (title + anchorDate)', async ({ request }) => {
      const res = await request.post('/api/projects', {
        data: { title: 'ML Zoomcamp 2026', anchorDate: '2026-06-01' },
      });
      expect(res.status()).toBe(201);

      const body = await res.json();
      expect(body.project).toBeDefined();
      expect(body.project.id).toMatch(UUID_RE);
      expect(body.project.title).toBe('ML Zoomcamp 2026');
      expect(body.project.anchorDate).toBe('2026-06-01');
      expect(body.project.createdAt).toMatch(ISO_TS_RE);
      expect(body.project.updatedAt).toMatch(ISO_TS_RE);

      // No tasks key when no templateId provided
      expect(body.tasks).toBeUndefined();
    });

    test('creates a project with optional description', async ({ request }) => {
      const res = await request.post('/api/projects', {
        data: {
          title: 'Newsletter',
          anchorDate: '2026-03-01',
          description: 'Weekly newsletter',
        },
      });
      expect(res.status()).toBe(201);

      const body = await res.json();
      expect(body.project.description).toBe('Weekly newsletter');
      expect(body.project.title).toBe('Newsletter');
      expect(body.project.anchorDate).toBe('2026-03-01');
    });

    test('returns 400 when title is missing', async ({ request }) => {
      const res = await request.post('/api/projects', {
        data: { anchorDate: '2026-06-01' },
      });
      expect(res.status()).toBe(400);

      const body = await res.json();
      expect(body.error).toBeDefined();
      expect(body.error.toLowerCase()).toContain('title');
    });

    test('returns 400 when anchorDate is missing', async ({ request }) => {
      const res = await request.post('/api/projects', {
        data: { title: 'Test' },
      });
      expect(res.status()).toBe(400);

      const body = await res.json();
      expect(body.error).toBeDefined();
      expect(body.error.toLowerCase()).toContain('anchordate');
    });

    test('returns 400 for invalid anchorDate format', async ({ request }) => {
      const res = await request.post('/api/projects', {
        data: { title: 'Bad date', anchorDate: '06-01-2026' },
      });
      expect(res.status()).toBe(400);

      const body = await res.json();
      expect(body.error).toBeDefined();
    });

    test('returns 400 for empty title string', async ({ request }) => {
      const res = await request.post('/api/projects', {
        data: { title: '   ', anchorDate: '2026-06-01' },
      });
      expect(res.status()).toBe(400);

      const body = await res.json();
      expect(body.error).toBeDefined();
      expect(body.error.toLowerCase()).toContain('title');
    });

    test('returns 201 and Content-Type application/json', async ({ request }) => {
      const res = await request.post('/api/projects', {
        data: { title: 'Content-Type test', anchorDate: '2026-07-01' },
      });
      expect(res.status()).toBe(201);
      expect(res.headers()['content-type']).toBe('application/json');
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // GET /api/projects — List all
  // ──────────────────────────────────────────────────────────────────

  test.describe('GET /api/projects', () => {
    test('lists all projects as an array', async ({ request }) => {
      // Ensure at least one project exists
      await request.post('/api/projects', {
        data: { title: 'List test', anchorDate: '2026-07-01' },
      });

      const res = await request.get('/api/projects');
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.projects).toBeInstanceOf(Array);
      expect(body.projects.length).toBeGreaterThan(0);
    });

    test('returns Content-Type application/json', async ({ request }) => {
      const res = await request.get('/api/projects');
      expect(res.status()).toBe(200);
      expect(res.headers()['content-type']).toBe('application/json');
    });

    test('each project in the list has expected fields', async ({ request }) => {
      await request.post('/api/projects', {
        data: { title: 'Fields check', anchorDate: '2026-08-01' },
      });

      const res = await request.get('/api/projects');
      const body = await res.json();

      const project = body.projects.find((p) => p.title === 'Fields check');
      expect(project).toBeDefined();
      expect(project.id).toMatch(UUID_RE);
      expect(project.anchorDate).toBe('2026-08-01');
      expect(project.createdAt).toBeTruthy();
      expect(project.updatedAt).toBeTruthy();
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // GET /api/projects/:id — Single project
  // ──────────────────────────────────────────────────────────────────

  test.describe('GET /api/projects/:id', () => {
    test('returns the project when it exists', async ({ request }) => {
      const create = await request.post('/api/projects', {
        data: { title: 'Fetch me', anchorDate: '2026-07-01', description: 'desc' },
      });
      const { project } = await create.json();

      const res = await request.get(`/api/projects/${project.id}`);
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.project.id).toBe(project.id);
      expect(body.project.title).toBe('Fetch me');
      expect(body.project.description).toBe('desc');
      expect(body.project.anchorDate).toBe('2026-07-01');
    });

    test('returns 404 for a non-existent project', async ({ request }) => {
      const res = await request.get('/api/projects/does-not-exist');
      expect(res.status()).toBe(404);

      const body = await res.json();
      expect(body.error).toBe('Project not found');
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // PUT /api/projects/:id — Update
  // ──────────────────────────────────────────────────────────────────

  test.describe('PUT /api/projects/:id', () => {
    test('updates the title of an existing project', async ({ request }) => {
      const create = await request.post('/api/projects', {
        data: { title: 'Old Title', anchorDate: '2026-07-01' },
      });
      const { project: original } = await create.json();

      const res = await request.put(`/api/projects/${original.id}`, {
        data: { title: 'New Title' },
      });
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.project.title).toBe('New Title');
      expect(body.project.id).toBe(original.id);
    });

    test('updates the description', async ({ request }) => {
      const create = await request.post('/api/projects', {
        data: { title: 'Desc project', anchorDate: '2026-07-01', description: 'original' },
      });
      const { project } = await create.json();

      const res = await request.put(`/api/projects/${project.id}`, {
        data: { description: 'updated description' },
      });
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.project.description).toBe('updated description');
    });

    test('updates the anchorDate', async ({ request }) => {
      const create = await request.post('/api/projects', {
        data: { title: 'Date project', anchorDate: '2026-07-01' },
      });
      const { project } = await create.json();

      const res = await request.put(`/api/projects/${project.id}`, {
        data: { anchorDate: '2026-08-15' },
      });
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.project.anchorDate).toBe('2026-08-15');
    });

    test('updatedAt changes after an update', async ({ request }) => {
      const create = await request.post('/api/projects', {
        data: { title: 'Timestamp project', anchorDate: '2026-07-01' },
      });
      const { project: original } = await create.json();

      // Small delay so timestamps differ
      await new Promise((r) => setTimeout(r, 50));

      const res = await request.put(`/api/projects/${original.id}`, {
        data: { title: 'Updated timestamp' },
      });
      const { project: updated } = await res.json();

      expect(updated.updatedAt).not.toBe(original.updatedAt);
    });

    test('returns 404 for a non-existent project', async ({ request }) => {
      const res = await request.put('/api/projects/does-not-exist', {
        data: { title: 'New' },
      });
      expect(res.status()).toBe(404);

      const body = await res.json();
      expect(body.error).toBe('Project not found');
    });

    test('returns 400 when body has no valid fields', async ({ request }) => {
      const create = await request.post('/api/projects', {
        data: { title: 'No valid fields', anchorDate: '2026-07-01' },
      });
      const { project } = await create.json();

      const res = await request.put(`/api/projects/${project.id}`, {
        data: { unknownField: 'value' },
      });
      expect(res.status()).toBe(400);
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // DELETE /api/projects/:id — Delete
  // ──────────────────────────────────────────────────────────────────

  test.describe('DELETE /api/projects/:id', () => {
    test('deletes an existing project and returns 204', async ({ request }) => {
      const create = await request.post('/api/projects', {
        data: { title: 'Delete me', anchorDate: '2026-07-01' },
      });
      const { project } = await create.json();

      const del = await request.delete(`/api/projects/${project.id}`);
      expect(del.status()).toBe(204);

      // Verify the response body is empty
      const text = await del.text();
      expect(text).toBe('');
    });

    test('deleted project is no longer retrievable', async ({ request }) => {
      const create = await request.post('/api/projects', {
        data: { title: 'Delete and verify', anchorDate: '2026-07-01' },
      });
      const { project } = await create.json();

      await request.delete(`/api/projects/${project.id}`);

      const get = await request.get(`/api/projects/${project.id}`);
      expect(get.status()).toBe(404);
    });

    test('returns 404 for a non-existent project', async ({ request }) => {
      const res = await request.delete('/api/projects/does-not-exist');
      expect(res.status()).toBe(404);

      const body = await res.json();
      expect(body.error).toBe('Project not found');
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // GET /api/projects/:id/tasks — Project tasks
  // ──────────────────────────────────────────────────────────────────

  test.describe('GET /api/projects/:id/tasks', () => {
    test('returns an empty tasks array for a project with no tasks', async ({ request }) => {
      const create = await request.post('/api/projects', {
        data: { title: 'No tasks project', anchorDate: '2026-07-01' },
      });
      const { project } = await create.json();

      const res = await request.get(`/api/projects/${project.id}/tasks`);
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.tasks).toBeInstanceOf(Array);
      expect(body.tasks).toHaveLength(0);
    });

    test('returns tasks that belong to the project', async ({ request }) => {
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

      // Create project with that template to generate tasks
      const create = await request.post('/api/projects', {
        data: { title: 'Has tasks', anchorDate: '2026-05-01', templateId: template.id },
      });
      const { project } = await create.json();

      const res = await request.get(`/api/projects/${project.id}/tasks`);
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.tasks).toHaveLength(2);
      expect(body.tasks.every((t) => t.projectId === project.id)).toBe(true);
    });

    test('returns 404 for a non-existent project', async ({ request }) => {
      const res = await request.get('/api/projects/does-not-exist/tasks');
      expect(res.status()).toBe(404);

      const body = await res.json();
      expect(body.error).toBe('Project not found');
    });
  });
});

// ──────────────────────────────────────────────────────────────────
// Project with template
// ──────────────────────────────────────────────────────────────────

test.describe('Project with template', () => {
  test('creates project from template and generates tasks with correct dates', async ({ request }) => {
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

    // Create project with anchorDate 2026-04-15
    const res = await request.post('/api/projects', {
      data: {
        title: 'Community Meetup',
        anchorDate: '2026-04-15',
        templateId: template.id,
      },
    });
    expect(res.status()).toBe(201);

    const body = await res.json();

    // Verify project
    expect(body.project).toBeDefined();
    expect(body.project.id).toMatch(UUID_RE);
    expect(body.project.title).toBe('Community Meetup');
    expect(body.project.templateId).toBe(template.id);

    // Verify tasks array is returned
    expect(body.tasks).toBeDefined();
    expect(body.tasks).toHaveLength(3);

    // Verify task dates: anchor 2026-04-15 with offsets -7, 0, +3
    const dates = body.tasks.map((t) => t.date).sort();
    expect(dates).toEqual(['2026-04-08', '2026-04-15', '2026-04-18']);
  });

  test('template tasks have source "template" and correct projectId', async ({ request }) => {
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

    const res = await request.post('/api/projects', {
      data: {
        title: 'Source check project',
        anchorDate: '2026-05-01',
        templateId: template.id,
      },
    });
    const body = await res.json();

    expect(body.tasks).toHaveLength(2);
    for (const task of body.tasks) {
      expect(task.source).toBe('template');
      expect(task.projectId).toBe(body.project.id);
    }
  });

  test('template tasks are retrievable via GET /api/projects/:id/tasks', async ({ request }) => {
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

    const createRes = await request.post('/api/projects', {
      data: {
        title: 'Conference',
        anchorDate: '2026-04-15',
        templateId: template.id,
      },
    });
    const { project, tasks: createdTasks } = await createRes.json();

    // Verify via the sub-route
    const tasksRes = await request.get(`/api/projects/${project.id}/tasks`);
    expect(tasksRes.status()).toBe(200);

    const tasksBody = await tasksRes.json();
    expect(tasksBody.tasks).toHaveLength(3);
    expect(tasksBody.tasks.every((t) => t.source === 'template')).toBe(true);
    expect(tasksBody.tasks.every((t) => t.projectId === project.id)).toBe(true);

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

    const res = await request.post('/api/projects', {
      data: {
        title: 'RefId project',
        anchorDate: '2026-06-10',
        templateId: template.id,
      },
    });
    const body = await res.json();

    const refs = body.tasks.map((t) => t.templateTaskRef).sort();
    expect(refs).toEqual(['ref-alpha', 'ref-beta']);
  });

  test('returns 404 when templateId does not exist', async ({ request }) => {
    const res = await request.post('/api/projects', {
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

  test('no project is created when templateId does not exist', async ({ request }) => {
    // Get current project count
    const before = await request.get('/api/projects');
    const beforeBody = await before.json();
    const countBefore = beforeBody.projects.length;

    // Attempt to create with bad template
    await request.post('/api/projects', {
      data: {
        title: 'Should not exist',
        anchorDate: '2026-01-01',
        templateId: 'nonexistent-template-id',
      },
    });

    // Verify project count has not increased
    const after = await request.get('/api/projects');
    const afterBody = await after.json();
    const countAfter = afterBody.projects.length;
    expect(countAfter).toBe(countBefore);
  });
});

// ──────────────────────────────────────────────────────────────────
// Existing routes still work
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
