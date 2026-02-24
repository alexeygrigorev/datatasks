const { test, expect } = require('@playwright/test');

test.describe('Recurring tasks API', () => {
  test('POST /api/recurring creates a config', async ({ request }) => {
    const res = await request.post('/api/recurring', {
      data: { description: 'Weekly standup', schedule: 'weekly', dayOfWeek: 1 },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.config.description).toBe('Weekly standup');
    expect(body.config.schedule).toBe('weekly');
    expect(body.config.dayOfWeek).toBe(1);
  });

  test('POST /api/recurring validates schedule', async ({ request }) => {
    const res = await request.post('/api/recurring', {
      data: { description: 'Bad', schedule: 'biweekly' },
    });
    expect(res.status()).toBe(400);
  });

  test('GET /api/recurring lists configs', async ({ request }) => {
    const res = await request.get('/api/recurring');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.recurringConfigs).toBeInstanceOf(Array);
    expect(body.recurringConfigs.length).toBeGreaterThan(0);
  });

  test('DELETE /api/recurring/:id deletes a config', async ({ request }) => {
    const create = await request.post('/api/recurring', {
      data: { description: 'Delete me', schedule: 'daily' },
    });
    const { config } = await create.json();

    const del = await request.delete(`/api/recurring/${config.id}`);
    expect(del.status()).toBe(204);
  });

  test('POST /api/recurring/generate creates tasks', async ({ request }) => {
    // Create a daily config
    await request.post('/api/recurring', {
      data: { description: 'Daily standup', schedule: 'daily' },
    });

    const res = await request.post('/api/recurring/generate', {
      data: { startDate: '2026-03-01', endDate: '2026-03-03' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.generated).toBeGreaterThanOrEqual(3);
  });

  test('POST /api/recurring/generate is idempotent', async ({ request }) => {
    // Generate again for same range
    const res = await request.post('/api/recurring/generate', {
      data: { startDate: '2026-03-01', endDate: '2026-03-03' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.generated).toBe(0);
    expect(body.skipped).toBeGreaterThan(0);
  });
});
