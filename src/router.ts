import fs from 'fs';
import path from 'path';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

import { handleBundleRoutes } from './routes/bundles';
import { handleTemplateRoutes } from './routes/templates';
import { handleRecurringRoutes } from './routes/recurring';
import { handleUserRoutes } from './routes/users';
import { handleFileRoutes } from './routes/files';
import { handleTelegramWebhook } from './routes/telegram';
import { handleEmailWebhook } from './routes/email';
import {
  createTask,
  getTask,
  updateTask,
  deleteTask,
  listTasksByDate,
  listTasksByDateRange,
  listTasksByBundle,
  listTasksByStatus,
} from './db/tasks';
import { updateBundle } from './db/bundles';
import { listFilesByTask } from './db/files';
import type { LambdaEvent, LambdaResponse, Task } from './types';

const JSON_HEADERS: Record<string, string> = { 'Content-Type': 'application/json' };

function jsonResponse(statusCode: number, body: unknown): LambdaResponse {
  return {
    statusCode,
    headers: JSON_HEADERS,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  };
}

function parseBody(event: LambdaEvent): Record<string, unknown> | null {
  if (!event.body) return null;
  if (typeof event.body === 'object') return event.body as Record<string, unknown>;
  try {
    return JSON.parse(event.body);
  } catch {
    return null;
  }
}

function extractTaskId(reqPath: string): string | null {
  const prefix = '/api/tasks/';
  if (reqPath.startsWith(prefix) && reqPath.length > prefix.length) {
    return reqPath.slice(prefix.length);
  }
  return null;
}

const ALLOWED_UPDATE_FIELDS = ['description', 'date', 'comment', 'status', 'bundleId', 'source', 'instructionsUrl', 'link', 'requiredLinkName', 'requiresFile', 'assigneeId', 'tags'];

async function route(event: LambdaEvent, client: DynamoDBDocumentClient): Promise<LambdaResponse> {
  const method = event.httpMethod || 'GET';
  const reqPath = event.path || '/';

  try {
    // GET / — serve SPA HTML
    if (method === 'GET' && reqPath === '/') {
      const htmlPath = path.join(__dirname, 'pages', 'index.html');
      const html = fs.readFileSync(htmlPath, 'utf-8');
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/html' },
        body: html,
      };
    }

    // GET /public/*.js — serve static JS files
    if (method === 'GET' && reqPath.startsWith('/public/')) {
      // Guard against path traversal
      if (reqPath.includes('..')) {
        return jsonResponse(404, { error: 'Not found' });
      }

      // Only serve .js files
      if (!reqPath.endsWith('.js')) {
        return jsonResponse(404, { error: 'Not found' });
      }

      const filename = reqPath.slice('/public/'.length);

      // Extra safety: reject if filename contains slashes (only serve from top-level public dir)
      if (filename.includes('/') || filename.includes('\\')) {
        return jsonResponse(404, { error: 'Not found' });
      }

      const filePath = path.join(__dirname, 'public', filename);

      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/javascript' },
          body: content,
        };
      } catch {
        return jsonResponse(404, { error: 'Not found' });
      }
    }

    // GET /api/health — health check
    if (method === 'GET' && reqPath === '/api/health') {
      return jsonResponse(200, { status: 'ok' });
    }

    // ── Task routes ────────────────────────────────────────────────

    // POST /api/tasks — Create a task
    if (method === 'POST' && reqPath === '/api/tasks') {
      const body = parseBody(event);
      if (!body) {
        return jsonResponse(400, { error: 'Request body is required' });
      }
      if (!body.description) {
        return jsonResponse(400, { error: 'Missing required field: description' });
      }
      if (!body.date) {
        return jsonResponse(400, { error: 'Missing required field: date' });
      }

      const taskData: Record<string, unknown> = {};
      if (body.description) taskData.description = body.description;
      if (body.date) taskData.date = body.date;
      if (body.comment !== undefined) taskData.comment = body.comment;
      if (body.bundleId !== undefined) taskData.bundleId = body.bundleId;
      if (body.instructionsUrl !== undefined) taskData.instructionsUrl = body.instructionsUrl;
      if (body.link !== undefined) taskData.link = body.link;
      if (body.requiredLinkName !== undefined) taskData.requiredLinkName = body.requiredLinkName;
      if (body.requiresFile !== undefined) taskData.requiresFile = body.requiresFile;
      if (body.assigneeId !== undefined) taskData.assigneeId = body.assigneeId;
      if (body.tags !== undefined) taskData.tags = body.tags;
      taskData.source = (body.source as string) || 'manual';

      const task = await createTask(client, taskData);
      return jsonResponse(201, task);
    }

    // GET /api/tasks — List tasks with filters
    if (method === 'GET' && reqPath === '/api/tasks') {
      const params = event.queryStringParameters || {};
      const { date, startDate, endDate, bundleId, status } = params;

      if (!date && !startDate && !endDate && !bundleId && !status) {
        return jsonResponse(400, {
          error: 'At least one filter is required: date, startDate+endDate, bundleId, or status',
        });
      }

      // Priority: date > startDate+endDate > bundleId > status
      if (date) {
        const tasks = await listTasksByDate(client, date);
        return jsonResponse(200, { tasks });
      }

      if (startDate || endDate) {
        if (!startDate || !endDate) {
          return jsonResponse(400, {
            error: 'Both startDate and endDate are required for range queries',
          });
        }
        const tasks = await listTasksByDateRange(client, startDate, endDate);
        return jsonResponse(200, { tasks });
      }

      if (bundleId) {
        const tasks = await listTasksByBundle(client, bundleId);
        return jsonResponse(200, { tasks });
      }

      if (status) {
        if (status !== 'todo' && status !== 'done' && status !== 'archived') {
          return jsonResponse(400, {
            error: "Invalid status. Must be 'todo', 'done', or 'archived'",
          });
        }
        const tasks = await listTasksByStatus(client, status);
        return jsonResponse(200, { tasks });
      }
    }

    // GET /api/tasks/:id — Get a single task
    if (method === 'GET' && reqPath.startsWith('/api/tasks/')) {
      const id = extractTaskId(reqPath);
      if (!id) {
        return jsonResponse(404, { error: 'Not found' });
      }
      const task = await getTask(client, id);
      if (!task) {
        return jsonResponse(404, { error: 'Task not found' });
      }
      return jsonResponse(200, task);
    }

    // PUT /api/tasks/:id — Update a task
    if (method === 'PUT' && reqPath.startsWith('/api/tasks/')) {
      const id = extractTaskId(reqPath);
      if (!id) {
        return jsonResponse(404, { error: 'Not found' });
      }

      const body = parseBody(event);
      if (!body) {
        return jsonResponse(400, { error: 'Request body is required' });
      }

      // Filter to allowed fields only
      const updates: Record<string, unknown> = {};
      for (const field of ALLOWED_UPDATE_FIELDS) {
        if (body[field] !== undefined) {
          updates[field] = body[field];
        }
      }

      if (Object.keys(updates).length === 0) {
        return jsonResponse(400, { error: 'No valid fields to update' });
      }

      // Verify task exists
      const existing = await getTask(client, id);
      if (!existing) {
        return jsonResponse(404, { error: 'Task not found' });
      }

      // requiredLinkName validation: cannot mark done if requiredLinkName is set but link is empty
      if (updates.status === 'done') {
        const effectiveRequiredLinkName = (updates.requiredLinkName !== undefined ? updates.requiredLinkName : (existing as Record<string, unknown>).requiredLinkName) as string | undefined;
        const effectiveLink = (updates.link !== undefined ? updates.link : (existing as Record<string, unknown>).link) as string | undefined;
        if (effectiveRequiredLinkName && !effectiveLink) {
          return jsonResponse(400, { error: `Cannot mark task as done: required link '${effectiveRequiredLinkName}' is not filled` });
        }

        // requiresFile validation: cannot mark done if requiresFile is true and no files uploaded
        const effectiveRequiresFile = (updates.requiresFile !== undefined ? updates.requiresFile : (existing as Record<string, unknown>).requiresFile) as boolean | undefined;
        if (effectiveRequiresFile) {
          const files = await listFilesByTask(client, id);
          if (files.length === 0) {
            return jsonResponse(400, { error: 'Cannot mark task as done: required file has not been uploaded' });
          }
        }
      }

      const updated = await updateTask(client, id, updates);

      // Stage transition: when a task with stageOnComplete is marked done,
      // automatically update the parent bundle's stage
      if (updated && updates.status === 'done' && existing.status !== 'done') {
        const task = updated as Task;
        if (task.stageOnComplete && task.bundleId && task.source === 'template') {
          await updateBundle(client, task.bundleId, { stage: task.stageOnComplete });
        }
      }

      return jsonResponse(200, updated);
    }

    // DELETE /api/tasks/:id — Delete a task
    if (method === 'DELETE' && reqPath.startsWith('/api/tasks/')) {
      const id = extractTaskId(reqPath);
      if (!id) {
        return jsonResponse(404, { error: 'Not found' });
      }
      await deleteTask(client, id);
      return {
        statusCode: 204,
        headers: JSON_HEADERS,
        body: '',
      };
    }

    // ── File routes ───────────────────────────────────────────────

    if (reqPath.startsWith('/api/files')) {
      const result = await handleFileRoutes(event);
      if (result) return result;
    }

    // ── Bundle routes ──────────────────────────────────────────────

    if (reqPath.startsWith('/api/bundles')) {
      const result = await handleBundleRoutes(reqPath, method, event.body || null);
      if (result) return result;
    }

    // ── Template routes ────────────────────────────────────────────

    if (reqPath.startsWith('/api/templates')) {
      const result = await handleTemplateRoutes(reqPath, method, event.body || null);
      if (result) return result;
    }

    // ── Recurring routes ───────────────────────────────────────────

    if (reqPath.startsWith('/api/recurring')) {
      const result = await handleRecurringRoutes(reqPath, method, event.body || null);
      if (result) return result;
    }

    // ── User routes ──────────────────────────────────────────────

    if (reqPath.startsWith('/api/users')) {
      const result = await handleUserRoutes(reqPath, method, event.body || null);
      if (result) return result;
    }

    // ── Telegram webhook ────────────────────────────────────────

    if (method === 'POST' && reqPath === '/api/webhook/telegram') {
      return handleTelegramWebhook(event);
    }

    // ── Email webhook ───────────────────────────────────────────

    if (method === 'POST' && reqPath === '/api/webhook/email') {
      return await handleEmailWebhook(event, client);
    }

    // Anything else — 404
    return jsonResponse(404, { error: 'Not found' });
  } catch (err: unknown) {
    console.error('Unexpected error:', err);
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

export { route };
