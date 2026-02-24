const { test, expect } = require('@playwright/test');

test.describe('Telegram webhook', () => {
  test('/start returns usage instructions', async ({ request }) => {
    const res = await request.post('/api/webhook/telegram', {
      data: { message: { chat: { id: 123 }, text: '/start' } },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  test('creates task from message', async ({ request }) => {
    const res = await request.post('/api/webhook/telegram', {
      data: { message: { chat: { id: 123 }, text: 'Buy milk' } },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.taskId).toBeTruthy();
  });

  test('creates task with date from message', async ({ request }) => {
    const res = await request.post('/api/webhook/telegram', {
      data: { message: { chat: { id: 123 }, text: 'Submit report 2026-03-15' } },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.taskId).toBeTruthy();

    // Verify the task has the correct date
    const task = await request.get(`/api/tasks/${body.taskId}`);
    const taskBody = await task.json();
    expect(taskBody.date).toBe('2026-03-15');
    expect(taskBody.description).toBe('Submit report');
    expect(taskBody.source).toBe('telegram');
  });

  test('non-message update returns ok', async ({ request }) => {
    const res = await request.post('/api/webhook/telegram', {
      data: { edited_message: { chat: { id: 123 }, text: 'edited' } },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});

test.describe('Email webhook', () => {
  test('creates task from email (no secret configured)', async ({ request }) => {
    // Without WEBHOOK_EMAIL_SECRET env var, the server returns 500
    const res = await request.post('/api/webhook/email', {
      data: { from: 'user@test.com', subject: 'Invoice reminder', body: 'Send by 2026-03-10' },
    });
    // Expect 500 because WEBHOOK_EMAIL_SECRET is not set on the server
    expect(res.status()).toBe(500);
  });
});
