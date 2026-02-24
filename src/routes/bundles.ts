import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { getClient } from '../db/client';
import {
  createBundle,
  getBundle,
  updateBundle,
  deleteBundle,
  listBundles,
} from '../db/bundles';
import { getTemplate, instantiateTemplate } from '../db/templates';
import { listTasksByBundle } from '../db/tasks';
import type { LambdaResponse } from '../types';

const JSON_HEADERS: Record<string, string> = { 'Content-Type': 'application/json' };

/**
 * Handle all /api/bundles routes.
 */
async function handleBundleRoutes(path: string, method: string, rawBody: string | null): Promise<LambdaResponse | null> {
  // Match /api/bundles paths
  if (!path.startsWith('/api/bundles')) {
    return null;
  }

  const client = await getClient();

  try {
    // Parse the path segments after /api/bundles
    const suffix = path.slice('/api/bundles'.length);

    // Route: /api/bundles (collection)
    if (suffix === '' || suffix === '/') {
      return await handleCollection(method, rawBody, client);
    }

    // Route: /api/bundles/:id/tasks
    const tasksMatch = suffix.match(/^\/([^/]+)\/tasks\/?$/);
    if (tasksMatch) {
      const id = tasksMatch[1];
      return await handleBundleTasks(method, id, client);
    }

    // Route: /api/bundles/:id
    const idMatch = suffix.match(/^\/([^/]+)\/?$/);
    if (idMatch) {
      const id = idMatch[1];
      return await handleSingle(method, id, rawBody, client);
    }

    // No match within /api/bundles
    return {
      statusCode: 404,
      headers: JSON_HEADERS,
      body: JSON.stringify({ error: 'Not found' }),
    };
  } catch (err: unknown) {
    console.error('Bundle route error:', err);
    return {
      statusCode: 500,
      headers: JSON_HEADERS,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}

/**
 * Handle /api/bundles collection routes (GET list, POST create).
 */
async function handleCollection(method: string, rawBody: string | null, client: DynamoDBDocumentClient): Promise<LambdaResponse> {
  if (method === 'GET') {
    const bundles = await listBundles(client);
    return {
      statusCode: 200,
      headers: JSON_HEADERS,
      body: JSON.stringify({ bundles }),
    };
  }

  if (method === 'POST') {
    // Parse body
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody!);
    } catch {
      return {
        statusCode: 400,
        headers: JSON_HEADERS,
        body: JSON.stringify({ error: 'Invalid JSON' }),
      };
    }

    // Validate required fields
    if (!body.title || typeof body.title !== 'string' || (body.title as string).trim() === '') {
      return {
        statusCode: 400,
        headers: JSON_HEADERS,
        body: JSON.stringify({ error: 'Missing required field: title' }),
      };
    }

    if (!body.anchorDate) {
      return {
        statusCode: 400,
        headers: JSON_HEADERS,
        body: JSON.stringify({ error: 'Missing required field: anchorDate' }),
      };
    }

    // Validate anchorDate format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.anchorDate as string)) {
      return {
        statusCode: 400,
        headers: JSON_HEADERS,
        body: JSON.stringify({ error: 'Invalid anchorDate format, expected YYYY-MM-DD' }),
      };
    }

    // If templateId is provided, verify template exists before creating bundle
    if (body.templateId) {
      const template = await getTemplate(client, body.templateId as string);
      if (!template) {
        return {
          statusCode: 404,
          headers: JSON_HEADERS,
          body: JSON.stringify({ error: 'Template not found' }),
        };
      }
    }

    // Build bundle data
    const bundleData: Record<string, unknown> = {
      title: body.title,
      anchorDate: body.anchorDate,
    };
    if (body.description !== undefined) {
      bundleData.description = body.description;
    }
    if (body.templateId !== undefined) {
      bundleData.templateId = body.templateId;
    }
    if (body.links !== undefined) {
      bundleData.links = body.links;
    }

    const bundle = await createBundle(client, bundleData);

    // If templateId provided, instantiate the template
    if (body.templateId) {
      const tasks = await instantiateTemplate(
        client,
        body.templateId as string,
        bundle.id,
        body.anchorDate as string
      );
      return {
        statusCode: 201,
        headers: JSON_HEADERS,
        body: JSON.stringify({ bundle, tasks }),
      };
    }

    return {
      statusCode: 201,
      headers: JSON_HEADERS,
      body: JSON.stringify({ bundle }),
    };
  }

  // Method not allowed
  return {
    statusCode: 405,
    headers: JSON_HEADERS,
    body: JSON.stringify({ error: 'Method not allowed' }),
  };
}

/**
 * Handle /api/bundles/:id single resource routes (GET, PUT, DELETE).
 */
async function handleSingle(method: string, id: string, rawBody: string | null, client: DynamoDBDocumentClient): Promise<LambdaResponse> {
  if (method === 'GET') {
    const bundle = await getBundle(client, id);
    if (!bundle) {
      return {
        statusCode: 404,
        headers: JSON_HEADERS,
        body: JSON.stringify({ error: 'Bundle not found' }),
      };
    }
    return {
      statusCode: 200,
      headers: JSON_HEADERS,
      body: JSON.stringify({ bundle }),
    };
  }

  if (method === 'PUT') {
    // Parse body
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody!);
    } catch {
      return {
        statusCode: 400,
        headers: JSON_HEADERS,
        body: JSON.stringify({ error: 'Invalid JSON' }),
      };
    }

    if (!body || typeof body !== 'object' || Object.keys(body).length === 0) {
      return {
        statusCode: 400,
        headers: JSON_HEADERS,
        body: JSON.stringify({ error: 'Request body is empty or invalid' }),
      };
    }

    // Check bundle exists
    const existing = await getBundle(client, id);
    if (!existing) {
      return {
        statusCode: 404,
        headers: JSON_HEADERS,
        body: JSON.stringify({ error: 'Bundle not found' }),
      };
    }

    // Only allow updating known fields
    const allowedFields = ['title', 'description', 'anchorDate', 'links'];
    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return {
        statusCode: 400,
        headers: JSON_HEADERS,
        body: JSON.stringify({ error: 'No valid fields to update' }),
      };
    }

    const bundle = await updateBundle(client, id, updates);
    return {
      statusCode: 200,
      headers: JSON_HEADERS,
      body: JSON.stringify({ bundle }),
    };
  }

  if (method === 'DELETE') {
    const existing = await getBundle(client, id);
    if (!existing) {
      return {
        statusCode: 404,
        headers: JSON_HEADERS,
        body: JSON.stringify({ error: 'Bundle not found' }),
      };
    }

    await deleteBundle(client, id);
    return {
      statusCode: 204,
      headers: JSON_HEADERS,
      body: '',
    };
  }

  // Method not allowed
  return {
    statusCode: 405,
    headers: JSON_HEADERS,
    body: JSON.stringify({ error: 'Method not allowed' }),
  };
}

/**
 * Handle /api/bundles/:id/tasks sub-route (GET only).
 */
async function handleBundleTasks(method: string, id: string, client: DynamoDBDocumentClient): Promise<LambdaResponse> {
  if (method !== 'GET') {
    return {
      statusCode: 405,
      headers: JSON_HEADERS,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  // Check bundle exists
  const bundle = await getBundle(client, id);
  if (!bundle) {
    return {
      statusCode: 404,
      headers: JSON_HEADERS,
      body: JSON.stringify({ error: 'Bundle not found' }),
    };
  }

  const tasks = await listTasksByBundle(client, id);
  return {
    statusCode: 200,
    headers: JSON_HEADERS,
    body: JSON.stringify({ tasks }),
  };
}

export { handleBundleRoutes };
