const { test, expect } = require('@playwright/test');

test.describe('Template CRUD API', () => {
  test('POST /api/templates creates a template', async ({ request }) => {
    const res = await request.post('/api/templates', {
      data: {
        name: 'Newsletter', type: 'newsletter',
        taskDefinitions: [
          { refId: 'n1', description: 'Write draft', offsetDays: -10 },
          { refId: 'n2', description: 'Send newsletter', offsetDays: 0 },
        ],
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.template.name).toBe('Newsletter');
    expect(body.template.taskDefinitions).toHaveLength(2);
  });

  test('POST /api/templates validates required fields', async ({ request }) => {
    const res = await request.post('/api/templates', { data: { name: 'No type' } });
    expect(res.status()).toBe(400);
  });

  test('GET /api/templates lists templates', async ({ request }) => {
    const res = await request.get('/api/templates');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.templates).toBeInstanceOf(Array);
  });

  test('GET /api/templates/:id returns a template', async ({ request }) => {
    const create = await request.post('/api/templates', {
      data: {
        name: 'Fetch', type: 'test',
        taskDefinitions: [{ refId: 'f1', description: 'Task', offsetDays: 0 }],
      },
    });
    const { template } = await create.json();

    const res = await request.get(`/api/templates/${template.id}`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.template.name).toBe('Fetch');
  });

  test('DELETE /api/templates/:id deletes a template', async ({ request }) => {
    const create = await request.post('/api/templates', {
      data: {
        name: 'Delete', type: 'test',
        taskDefinitions: [{ refId: 'd1', description: 'Task', offsetDays: 0 }],
      },
    });
    const { template } = await create.json();

    const del = await request.delete(`/api/templates/${template.id}`);
    expect(del.status()).toBe(204);

    const get = await request.get(`/api/templates/${template.id}`);
    expect(get.status()).toBe(404);
  });
});
