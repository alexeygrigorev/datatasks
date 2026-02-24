const { test, expect } = require('@playwright/test');

test.describe('Task CRUD API', () => {

  // ── Helper ────────────────────────────────────────────────────────────
  /** Create a task and return its JSON body. */
  async function createTestTask(request, overrides = {}) {
    const data = {
      description: 'Test task',
      date: '2026-03-10',
      ...overrides,
    };
    const res = await request.post('/api/tasks', { data });
    expect(res.status()).toBe(201);
    return res.json();
  }

  // ── POST /api/tasks ───────────────────────────────────────────────────

  test.describe('POST /api/tasks', () => {

    test('creates a task with default fields', async ({ request }) => {
      const body = await createTestTask(request, {
        description: 'Review draft',
        date: '2026-03-10',
      });

      expect(body.id).toBeTruthy();
      expect(body.description).toBe('Review draft');
      expect(body.date).toBe('2026-03-10');
      expect(body.status).toBe('todo');
      expect(body.source).toBe('manual');
      expect(body.createdAt).toBeTruthy();
      expect(body.updatedAt).toBeTruthy();
      // createdAt and updatedAt should be valid ISO timestamps
      expect(new Date(body.createdAt).toISOString()).toBe(body.createdAt);
      expect(new Date(body.updatedAt).toISOString()).toBe(body.updatedAt);
    });

    test('creates a task with all optional fields', async ({ request }) => {
      const res = await request.post('/api/tasks', {
        data: {
          description: 'Review draft',
          date: '2026-03-10',
          comment: 'Important',
          projectId: 'proj-1',
          source: 'telegram',
        },
      });
      expect(res.status()).toBe(201);
      const body = await res.json();

      expect(body.comment).toBe('Important');
      expect(body.projectId).toBe('proj-1');
      expect(body.source).toBe('telegram');
    });

    test('returns 400 when description is missing', async ({ request }) => {
      const res = await request.post('/api/tasks', {
        data: { date: '2026-03-10' },
      });
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('Missing required field: description');
    });

    test('returns 400 when date is missing', async ({ request }) => {
      const res = await request.post('/api/tasks', {
        data: { description: 'Review draft' },
      });
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('Missing required field: date');
    });

    test('source defaults to manual when not provided', async ({ request }) => {
      const body = await createTestTask(request, {
        description: 'No source specified',
        date: '2026-03-10',
      });
      expect(body.source).toBe('manual');
    });

    test('source can be set to telegram', async ({ request }) => {
      const body = await createTestTask(request, {
        description: 'Telegram task',
        date: '2026-03-10',
        source: 'telegram',
      });
      expect(body.source).toBe('telegram');
    });

    test('source can be set to email', async ({ request }) => {
      const body = await createTestTask(request, {
        description: 'Email task',
        date: '2026-03-10',
        source: 'email',
      });
      expect(body.source).toBe('email');
    });

    test('source can be set to template', async ({ request }) => {
      const body = await createTestTask(request, {
        description: 'Template task',
        date: '2026-03-10',
        source: 'template',
      });
      expect(body.source).toBe('template');
    });

    test('source can be set to recurring', async ({ request }) => {
      const body = await createTestTask(request, {
        description: 'Recurring task',
        date: '2026-03-10',
        source: 'recurring',
      });
      expect(body.source).toBe('recurring');
    });
  });

  // ── GET /api/tasks (list with filters) ────────────────────────────────

  test.describe('GET /api/tasks', () => {

    test('returns 400 when no filters are provided', async ({ request }) => {
      const res = await request.get('/api/tasks');
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('At least one filter is required');
    });

    test('filters by date', async ({ request }) => {
      // Create two tasks on the target date and one on a different date
      const targetDate = '2026-04-01';
      const otherDate = '2026-04-02';
      await createTestTask(request, { description: 'Task A', date: targetDate });
      await createTestTask(request, { description: 'Task B', date: targetDate });
      await createTestTask(request, { description: 'Task C', date: otherDate });

      const res = await request.get(`/api/tasks?date=${targetDate}`);
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.tasks).toBeInstanceOf(Array);
      expect(body.tasks.length).toBeGreaterThanOrEqual(2);
      expect(body.tasks.every(t => t.date === targetDate)).toBe(true);
    });

    test('filters by date range (startDate + endDate)', async ({ request }) => {
      // Create tasks at known dates
      await createTestTask(request, { description: 'Range-before', date: '2026-05-01' });
      await createTestTask(request, { description: 'Range-in-1', date: '2026-05-10' });
      await createTestTask(request, { description: 'Range-in-2', date: '2026-05-15' });
      await createTestTask(request, { description: 'Range-after', date: '2026-05-25' });

      const res = await request.get('/api/tasks?startDate=2026-05-09&endDate=2026-05-16');
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.tasks).toBeInstanceOf(Array);
      expect(body.tasks.length).toBeGreaterThanOrEqual(2);
      for (const t of body.tasks) {
        expect(t.date >= '2026-05-09').toBe(true);
        expect(t.date <= '2026-05-16').toBe(true);
      }
    });

    test('returns 400 when startDate is provided without endDate', async ({ request }) => {
      const res = await request.get('/api/tasks?startDate=2026-03-01');
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('Both startDate and endDate are required');
    });

    test('returns 400 when endDate is provided without startDate', async ({ request }) => {
      const res = await request.get('/api/tasks?endDate=2026-03-31');
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('Both startDate and endDate are required');
    });

    test('filters by status', async ({ request }) => {
      // Create a task that will definitely be 'todo'
      await createTestTask(request, { description: 'Status filter test', date: '2026-06-01' });

      const res = await request.get('/api/tasks?status=todo');
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.tasks).toBeInstanceOf(Array);
      expect(body.tasks.length).toBeGreaterThan(0);
      expect(body.tasks.every(t => t.status === 'todo')).toBe(true);
    });

    test('filters by status=done', async ({ request }) => {
      // Create and update a task to done
      const task = await createTestTask(request, { description: 'Done task', date: '2026-06-02' });
      await request.put(`/api/tasks/${task.id}`, { data: { status: 'done' } });

      const res = await request.get('/api/tasks?status=done');
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.tasks).toBeInstanceOf(Array);
      expect(body.tasks.length).toBeGreaterThan(0);
      expect(body.tasks.every(t => t.status === 'done')).toBe(true);
    });

    test('returns 400 for invalid status value', async ({ request }) => {
      const res = await request.get('/api/tasks?status=invalid');
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("Invalid status");
    });

    test('filters by projectId', async ({ request }) => {
      const pid = `proj-test-${Date.now()}`;
      await createTestTask(request, { description: 'Proj task 1', date: '2026-06-03', projectId: pid });
      await createTestTask(request, { description: 'Proj task 2', date: '2026-06-04', projectId: pid });
      await createTestTask(request, { description: 'Proj task 3', date: '2026-06-05', projectId: 'other-proj' });

      const res = await request.get(`/api/tasks?projectId=${pid}`);
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.tasks).toBeInstanceOf(Array);
      expect(body.tasks.length).toBe(2);
      expect(body.tasks.every(t => t.projectId === pid)).toBe(true);
    });
  });

  // ── GET /api/tasks/:id ────────────────────────────────────────────────

  test.describe('GET /api/tasks/:id', () => {

    test('returns a task by ID', async ({ request }) => {
      const created = await createTestTask(request, {
        description: 'Fetch me by ID',
        date: '2026-03-15',
      });

      const res = await request.get(`/api/tasks/${created.id}`);
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.id).toBe(created.id);
      expect(body.description).toBe('Fetch me by ID');
      expect(body.date).toBe('2026-03-15');
      expect(body.status).toBe('todo');
    });

    test('returns 404 for a nonexistent task', async ({ request }) => {
      const res = await request.get('/api/tasks/nonexistent-id-abc');
      expect(res.status()).toBe(404);
      const body = await res.json();
      expect(body.error).toBe('Task not found');
    });
  });

  // ── PUT /api/tasks/:id ────────────────────────────────────────────────

  test.describe('PUT /api/tasks/:id', () => {

    test('updates status', async ({ request }) => {
      const created = await createTestTask(request, {
        description: 'Update status test',
        date: '2026-03-20',
      });
      expect(created.status).toBe('todo');

      const res = await request.put(`/api/tasks/${created.id}`, {
        data: { status: 'done' },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('done');
    });

    test('updates description', async ({ request }) => {
      const created = await createTestTask(request, {
        description: 'Old description',
        date: '2026-03-20',
      });

      const res = await request.put(`/api/tasks/${created.id}`, {
        data: { description: 'New description' },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.description).toBe('New description');
    });

    test('updates comment', async ({ request }) => {
      const created = await createTestTask(request, {
        description: 'Comment update test',
        date: '2026-03-20',
      });

      const res = await request.put(`/api/tasks/${created.id}`, {
        data: { comment: 'New comment' },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.comment).toBe('New comment');
    });

    test('updates multiple fields at once', async ({ request }) => {
      const created = await createTestTask(request, {
        description: 'Multi-update test',
        date: '2026-03-20',
      });

      const res = await request.put(`/api/tasks/${created.id}`, {
        data: { status: 'done', comment: 'Completed', description: 'Updated multi' },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('done');
      expect(body.comment).toBe('Completed');
      expect(body.description).toBe('Updated multi');
    });

    test('updatedAt changes on update', async ({ request }) => {
      const created = await createTestTask(request, {
        description: 'Timestamp test',
        date: '2026-03-20',
      });
      const originalUpdatedAt = created.updatedAt;

      // Small delay to ensure timestamp differs
      await new Promise(r => setTimeout(r, 50));

      const res = await request.put(`/api/tasks/${created.id}`, {
        data: { comment: 'trigger update' },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.updatedAt).not.toBe(originalUpdatedAt);
      expect(new Date(body.updatedAt) >= new Date(originalUpdatedAt)).toBe(true);
    });

    test('returns 404 for nonexistent task', async ({ request }) => {
      const res = await request.put('/api/tasks/nonexistent-id-xyz', {
        data: { status: 'done' },
      });
      expect(res.status()).toBe(404);
      const body = await res.json();
      expect(body.error).toBe('Task not found');
    });

    test('returns 400 when body has no valid fields', async ({ request }) => {
      const created = await createTestTask(request, {
        description: 'No valid fields test',
        date: '2026-03-20',
      });

      const res = await request.put(`/api/tasks/${created.id}`, {
        data: { id: 'hacked', PK: 'bad', createdAt: 'nope' },
      });
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('No valid fields to update');
    });

    test('strips disallowed fields and only updates allowed ones', async ({ request }) => {
      const created = await createTestTask(request, {
        description: 'Strip fields test',
        date: '2026-03-20',
      });
      const originalId = created.id;

      const res = await request.put(`/api/tasks/${created.id}`, {
        data: { status: 'done', id: 'hacked-id', PK: 'bad-pk' },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('done');
      expect(body.id).toBe(originalId);
    });
  });

  // ── DELETE /api/tasks/:id ─────────────────────────────────────────────

  test.describe('DELETE /api/tasks/:id', () => {

    test('deletes a task and returns 204', async ({ request }) => {
      const created = await createTestTask(request, {
        description: 'Delete me',
        date: '2026-03-25',
      });

      const del = await request.delete(`/api/tasks/${created.id}`);
      expect(del.status()).toBe(204);

      // Verify the task is gone
      const get = await request.get(`/api/tasks/${created.id}`);
      expect(get.status()).toBe(404);
    });

    test('returns 204 for a nonexistent task (idempotent)', async ({ request }) => {
      const del = await request.delete('/api/tasks/nonexistent-id-del');
      expect(del.status()).toBe(204);
    });
  });

  // ── Existing routes ───────────────────────────────────────────────────

  test.describe('Existing routes', () => {

    test('GET / returns HTML', async ({ request }) => {
      const res = await request.get('/');
      expect(res.status()).toBe(200);
      const contentType = res.headers()['content-type'];
      expect(contentType).toContain('text/html');
    });

    test('GET /api/health returns ok', async ({ request }) => {
      const res = await request.get('/api/health');
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('ok');
    });

    test('GET /api/unknown returns 404', async ({ request }) => {
      const res = await request.get('/api/unknown');
      expect(res.status()).toBe(404);
    });
  });
});
