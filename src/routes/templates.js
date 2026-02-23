const { getClient } = require('../db/client');
const {
  createTemplate,
  getTemplate,
  updateTemplate,
  deleteTemplate,
  listTemplates,
} = require('../db/templates');

const JSON_HEADERS = { 'Content-Type': 'application/json' };

/**
 * Validate an array of task definitions.
 * Returns an error string if invalid, or null if valid.
 */
function validateTaskDefinitions(taskDefinitions) {
  if (!Array.isArray(taskDefinitions) || taskDefinitions.length === 0) {
    return 'taskDefinitions must be a non-empty array';
  }

  for (let i = 0; i < taskDefinitions.length; i++) {
    const td = taskDefinitions[i];
    if (!td.refId || typeof td.refId !== 'string') {
      return `taskDefinitions[${i}] is missing required field: refId`;
    }
    if (!td.description || typeof td.description !== 'string') {
      return `taskDefinitions[${i}] is missing required field: description`;
    }
    if (td.offsetDays === undefined || td.offsetDays === null || typeof td.offsetDays !== 'number') {
      return `taskDefinitions[${i}] is missing required field: offsetDays`;
    }
  }

  return null;
}

/**
 * Handle all /api/templates routes.
 *
 * @param {string} path - The request path (e.g. /api/templates, /api/templates/abc-123)
 * @param {string} method - HTTP method (GET, POST, PUT, DELETE)
 * @param {string|null} rawBody - Raw request body string
 * @returns {object|null} Lambda response object, or null if path does not match
 */
async function handleTemplateRoutes(path, method, rawBody) {
  // Match /api/templates paths
  if (!path.startsWith('/api/templates')) {
    return null;
  }

  const client = await getClient();

  try {
    // Parse the path segments after /api/templates
    const suffix = path.slice('/api/templates'.length);
    // suffix is '', '/', '/:id'

    // Route: /api/templates (collection)
    if (suffix === '' || suffix === '/') {
      return await handleCollection(method, rawBody, client);
    }

    // Route: /api/templates/:id
    const idMatch = suffix.match(/^\/([^/]+)\/?$/);
    if (idMatch) {
      const id = idMatch[1];
      return await handleSingle(method, id, rawBody, client);
    }

    // No match within /api/templates
    return {
      statusCode: 404,
      headers: JSON_HEADERS,
      body: JSON.stringify({ error: 'Not found' }),
    };
  } catch (err) {
    console.error('Template route error:', err);
    return {
      statusCode: 500,
      headers: JSON_HEADERS,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}

/**
 * Handle /api/templates collection routes (GET list, POST create).
 */
async function handleCollection(method, rawBody, client) {
  if (method === 'GET') {
    const templates = await listTemplates(client);
    return {
      statusCode: 200,
      headers: JSON_HEADERS,
      body: JSON.stringify({ templates }),
    };
  }

  if (method === 'POST') {
    // Parse body
    let body;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return {
        statusCode: 400,
        headers: JSON_HEADERS,
        body: JSON.stringify({ error: 'Invalid JSON' }),
      };
    }

    // Validate required fields
    if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
      return {
        statusCode: 400,
        headers: JSON_HEADERS,
        body: JSON.stringify({ error: 'Missing required field: name' }),
      };
    }

    if (!body.type || typeof body.type !== 'string' || body.type.trim() === '') {
      return {
        statusCode: 400,
        headers: JSON_HEADERS,
        body: JSON.stringify({ error: 'Missing required field: type' }),
      };
    }

    if (!body.taskDefinitions) {
      return {
        statusCode: 400,
        headers: JSON_HEADERS,
        body: JSON.stringify({ error: 'Missing required field: taskDefinitions' }),
      };
    }

    const tdError = validateTaskDefinitions(body.taskDefinitions);
    if (tdError) {
      return {
        statusCode: 400,
        headers: JSON_HEADERS,
        body: JSON.stringify({ error: tdError }),
      };
    }

    const templateData = {
      name: body.name,
      type: body.type,
      taskDefinitions: body.taskDefinitions,
    };

    const template = await createTemplate(client, templateData);
    return {
      statusCode: 201,
      headers: JSON_HEADERS,
      body: JSON.stringify({ template }),
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
 * Handle /api/templates/:id single resource routes (GET, PUT, DELETE).
 */
async function handleSingle(method, id, rawBody, client) {
  if (method === 'GET') {
    const template = await getTemplate(client, id);
    if (!template) {
      return {
        statusCode: 404,
        headers: JSON_HEADERS,
        body: JSON.stringify({ error: 'Template not found' }),
      };
    }
    return {
      statusCode: 200,
      headers: JSON_HEADERS,
      body: JSON.stringify({ template }),
    };
  }

  if (method === 'PUT') {
    // Parse body
    let body;
    try {
      body = JSON.parse(rawBody);
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

    // Check template exists
    const existing = await getTemplate(client, id);
    if (!existing) {
      return {
        statusCode: 404,
        headers: JSON_HEADERS,
        body: JSON.stringify({ error: 'Template not found' }),
      };
    }

    // Only allow updating known fields
    const allowedFields = ['name', 'type', 'taskDefinitions'];
    const updates = {};
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

    // Validate taskDefinitions if provided
    if (updates.taskDefinitions !== undefined) {
      const tdError = validateTaskDefinitions(updates.taskDefinitions);
      if (tdError) {
        return {
          statusCode: 400,
          headers: JSON_HEADERS,
          body: JSON.stringify({ error: tdError }),
        };
      }
    }

    const template = await updateTemplate(client, id, updates);
    return {
      statusCode: 200,
      headers: JSON_HEADERS,
      body: JSON.stringify({ template }),
    };
  }

  if (method === 'DELETE') {
    const existing = await getTemplate(client, id);
    if (!existing) {
      return {
        statusCode: 404,
        headers: JSON_HEADERS,
        body: JSON.stringify({ error: 'Template not found' }),
      };
    }

    await deleteTemplate(client, id);
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

module.exports = { handleTemplateRoutes };
