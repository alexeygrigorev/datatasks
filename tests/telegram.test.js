const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

const { startLocal, stopLocal, getClient } = require('../src/db/client');
const { createTables, deleteTables } = require('../src/db/setup');
const { parseMessage, handleTelegramWebhook } = require('../src/routes/telegram');

describe('Telegram integration', () => {
  let port;

  before(async () => {
    port = await startLocal();
    process.env.IS_LOCAL = 'true';
    process.env.TELEGRAM_WEBHOOK_SECRET = 'test-secret';
    // Do not set TELEGRAM_BOT_TOKEN so sendTelegramReply is skipped in tests
    delete process.env.TELEGRAM_BOT_TOKEN;
  });

  after(async () => {
    await stopLocal();
    delete process.env.IS_LOCAL;
    delete process.env.TELEGRAM_WEBHOOK_SECRET;
  });

  // ── parseMessage ─────────────────────────────────────────────────

  describe('parseMessage', () => {
    it('extracts description and date when date is at the end', () => {
      const result = parseMessage('Buy groceries 2026-03-10');
      assert.strictEqual(result.description, 'Buy groceries');
      assert.strictEqual(result.date, '2026-03-10');
    });

    it('uses today as default date when no date is provided', () => {
      const result = parseMessage('Buy groceries');
      assert.strictEqual(result.description, 'Buy groceries');
      const today = new Date().toISOString().slice(0, 10);
      assert.strictEqual(result.date, today);
    });

    it('handles message with only a date (no description before it)', () => {
      // "2026-05-01" has no space before the date, so the regex won't match
      // and the entire string becomes the description with today's date
      const result = parseMessage('2026-05-01');
      assert.strictEqual(result.description, '2026-05-01');
      const today = new Date().toISOString().slice(0, 10);
      assert.strictEqual(result.date, today);
    });

    it('handles message with trailing whitespace', () => {
      const result = parseMessage('  Submit report  ');
      assert.strictEqual(result.description, 'Submit report');
      const today = new Date().toISOString().slice(0, 10);
      assert.strictEqual(result.date, today);
    });

    it('handles multi-word description with date', () => {
      const result = parseMessage('Dentist appointment downtown 2026-04-15');
      assert.strictEqual(result.description, 'Dentist appointment downtown');
      assert.strictEqual(result.date, '2026-04-15');
    });
  });

  // ── handleTelegramWebhook ────────────────────────────────────────

  describe('handleTelegramWebhook', () => {
    it('creates a task from a plain message with source "telegram"', async () => {
      const event = {
        headers: { 'x-telegram-bot-api-secret-token': 'test-secret' },
        body: JSON.stringify({
          message: {
            message_id: 1,
            chat: { id: 12345 },
            text: 'Buy groceries'
          }
        })
      };

      const res = await handleTelegramWebhook(event);
      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.strictEqual(body.ok, true);
      assert.ok(body.taskId);

      // Verify the task was created with correct fields
      const { getTask } = require('../src/db/tasks');
      const client = await getClient();
      const task = await getTask(client, body.taskId);
      assert.strictEqual(task.description, 'Buy groceries');
      assert.strictEqual(task.source, 'telegram');
      const today = new Date().toISOString().slice(0, 10);
      assert.strictEqual(task.date, today);
    });

    it('creates a task with an explicit date from the message', async () => {
      const event = {
        headers: { 'x-telegram-bot-api-secret-token': 'test-secret' },
        body: JSON.stringify({
          message: {
            message_id: 2,
            chat: { id: 12345 },
            text: 'Dentist appointment 2026-04-15'
          }
        })
      };

      const res = await handleTelegramWebhook(event);
      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.ok(body.taskId);

      const { getTask } = require('../src/db/tasks');
      const client = await getClient();
      const task = await getTask(client, body.taskId);
      assert.strictEqual(task.description, 'Dentist appointment');
      assert.strictEqual(task.date, '2026-04-15');
      assert.strictEqual(task.source, 'telegram');
    });

    it('/start command returns instructions and does not create a task', async () => {
      const event = {
        headers: { 'x-telegram-bot-api-secret-token': 'test-secret' },
        body: JSON.stringify({
          message: {
            message_id: 3,
            chat: { id: 12345 },
            text: '/start'
          }
        })
      };

      const res = await handleTelegramWebhook(event);
      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.strictEqual(body.ok, true);
      // No taskId should be returned for /start
      assert.strictEqual(body.taskId, undefined);
    });

    it('returns 401 when secret token is missing', async () => {
      const event = {
        headers: {},
        body: JSON.stringify({
          message: {
            message_id: 4,
            chat: { id: 12345 },
            text: 'Should not create'
          }
        })
      };

      const res = await handleTelegramWebhook(event);
      assert.strictEqual(res.statusCode, 401);
      const body = JSON.parse(res.body);
      assert.strictEqual(body.error, 'Unauthorized');
    });

    it('returns 401 when secret token is wrong', async () => {
      const event = {
        headers: { 'x-telegram-bot-api-secret-token': 'wrong-secret' },
        body: JSON.stringify({
          message: {
            message_id: 5,
            chat: { id: 12345 },
            text: 'Should not create'
          }
        })
      };

      const res = await handleTelegramWebhook(event);
      assert.strictEqual(res.statusCode, 401);
      const body = JSON.parse(res.body);
      assert.strictEqual(body.error, 'Unauthorized');
    });

    it('returns 200 ok for non-message updates', async () => {
      const event = {
        headers: { 'x-telegram-bot-api-secret-token': 'test-secret' },
        body: JSON.stringify({
          edited_message: {
            message_id: 6,
            chat: { id: 12345 },
            text: 'Edited text'
          }
        })
      };

      const res = await handleTelegramWebhook(event);
      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.strictEqual(body.ok, true);
      assert.strictEqual(body.taskId, undefined);
    });

    it('handles message with only a date gracefully', async () => {
      // "2026-05-01" should be treated as a description (no space before date)
      const event = {
        headers: { 'x-telegram-bot-api-secret-token': 'test-secret' },
        body: JSON.stringify({
          message: {
            message_id: 7,
            chat: { id: 12345 },
            text: '2026-05-01'
          }
        })
      };

      const res = await handleTelegramWebhook(event);
      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.ok(body.taskId);

      const { getTask } = require('../src/db/tasks');
      const client = await getClient();
      const task = await getTask(client, body.taskId);
      assert.strictEqual(task.description, '2026-05-01');
      const today = new Date().toISOString().slice(0, 10);
      assert.strictEqual(task.date, today);
      assert.strictEqual(task.source, 'telegram');
    });
  });
});
