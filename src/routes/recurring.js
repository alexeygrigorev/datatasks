const { getClient } = require('../db/client');
const {
  createRecurringConfig,
  getRecurringConfig,
  updateRecurringConfig,
  deleteRecurringConfig,
  listRecurringConfigs,
  generateRecurringTasks,
} = require('../db/recurring');

const JSON_HEADERS = { 'Content-Type': 'application/json' };

const VALID_SCHEDULES = ['daily', 'weekly', 'monthly'];

/**
 * Validate recurring config data for create/update.
 * Returns an error string if invalid, or null if valid.
 */
function validateRecurringData(body, isUpdate) {
  if (!isUpdate) {
    // Required fields for creation
    if (!body.description || typeof body.description !== 'string' || body.description.trim() === '') {
      return 'Missing required field: description';
    }

    if (!body.schedule || !VALID_SCHEDULES.includes(body.schedule)) {
      return 'schedule must be one of: daily, weekly, monthly';
    }
  }

  // Validate schedule-specific fields
  const schedule = body.schedule;

  if (schedule === 'weekly') {
    if (body.dayOfWeek === undefined || body.dayOfWeek === null) {
      return 'dayOfWeek is required when schedule is weekly';
    }
    if (!Number.isInteger(body.dayOfWeek) || body.dayOfWeek < 0 || body.dayOfWeek > 6) {
      return 'dayOfWeek must be an integer between 0 and 6';
    }
  }

  if (schedule === 'monthly') {
    if (body.dayOfMonth === undefined || body.dayOfMonth === null) {
      return 'dayOfMonth is required when schedule is monthly';
    }
    if (!Number.isInteger(body.dayOfMonth) || body.dayOfMonth < 1 || body.dayOfMonth > 31) {
      return 'dayOfMonth must be an integer between 1 and 31';
    }
  }

  return null;
}

/**
 * Handle all /api/recurring routes.
 *
 * @param {string} path - The request path
 * @param {string} method - HTTP method
 * @param {string|null} rawBody - Raw request body string
 * @returns {object|null} Lambda response object, or null if path does not match
 */
async function handleRecurringRoutes(path, method, rawBody) {
  if (!path.startsWith('/api/recurring')) {
    return null;
  }

  const client = await getClient();

  try {
    const suffix = path.slice('/api/recurring'.length);

    // Route: /api/recurring/generate (must be matched before /:id)
    if (suffix === '/generate') {
      return await handleGenerate(method, rawBody, client);
    }

    // Route: /api/recurring (collection)
    if (suffix === '' || suffix === '/') {
      return await handleCollection(method, rawBody, client);
    }

    // Route: /api/recurring/:id
    const idMatch = suffix.match(/^\/([^/]+)\/?$/);
    if (idMatch) {
      const id = idMatch[1];
      return await handleSingle(method, id, rawBody, client);
    }

    // No match within /api/recurring
    return {
      statusCode: 404,
      headers: JSON_HEADERS,
      body: JSON.stringify({ error: 'Not found' }),
    };
  } catch (err) {
    console.error('Recurring route error:', err);
    return {
      statusCode: 500,
      headers: JSON_HEADERS,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}

/**
 * Handle /api/recurring collection routes (GET list, POST create).
 */
async function handleCollection(method, rawBody, client) {
  if (method === 'GET') {
    const recurringConfigs = await listRecurringConfigs(client);
    return {
      statusCode: 200,
      headers: JSON_HEADERS,
      body: JSON.stringify({ recurringConfigs }),
    };
  }

  if (method === 'POST') {
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

    const validationError = validateRecurringData(body, false);
    if (validationError) {
      return {
        statusCode: 400,
        headers: JSON_HEADERS,
        body: JSON.stringify({ error: validationError }),
      };
    }

    const allowedFields = ['description', 'schedule', 'dayOfWeek', 'dayOfMonth', 'projectId', 'enabled'];
    const data = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        data[field] = body[field];
      }
    }

    const recurringConfig = await createRecurringConfig(client, data);
    return {
      statusCode: 201,
      headers: JSON_HEADERS,
      body: JSON.stringify({ recurringConfig }),
    };
  }

  return {
    statusCode: 405,
    headers: JSON_HEADERS,
    body: JSON.stringify({ error: 'Method not allowed' }),
  };
}

/**
 * Handle /api/recurring/:id single resource routes (GET, PUT, DELETE).
 */
async function handleSingle(method, id, rawBody, client) {
  if (method === 'GET') {
    const recurringConfig = await getRecurringConfig(client, id);
    if (!recurringConfig) {
      return {
        statusCode: 404,
        headers: JSON_HEADERS,
        body: JSON.stringify({ error: 'Recurring config not found' }),
      };
    }
    return {
      statusCode: 200,
      headers: JSON_HEADERS,
      body: JSON.stringify({ recurringConfig }),
    };
  }

  if (method === 'PUT') {
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

    // Check config exists
    const existing = await getRecurringConfig(client, id);
    if (!existing) {
      return {
        statusCode: 404,
        headers: JSON_HEADERS,
        body: JSON.stringify({ error: 'Recurring config not found' }),
      };
    }

    // Validate schedule-specific fields if schedule is being updated
    const effectiveSchedule = body.schedule || existing.schedule;
    const validationBody = { ...body, schedule: effectiveSchedule };
    const validationError = validateRecurringData(validationBody, true);
    if (validationError) {
      return {
        statusCode: 400,
        headers: JSON_HEADERS,
        body: JSON.stringify({ error: validationError }),
      };
    }

    const allowedFields = ['description', 'schedule', 'dayOfWeek', 'dayOfMonth', 'projectId', 'enabled'];
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

    const recurringConfig = await updateRecurringConfig(client, id, updates);
    return {
      statusCode: 200,
      headers: JSON_HEADERS,
      body: JSON.stringify({ recurringConfig }),
    };
  }

  if (method === 'DELETE') {
    const existing = await getRecurringConfig(client, id);
    if (!existing) {
      return {
        statusCode: 404,
        headers: JSON_HEADERS,
        body: JSON.stringify({ error: 'Recurring config not found' }),
      };
    }

    await deleteRecurringConfig(client, id);
    return {
      statusCode: 204,
      headers: JSON_HEADERS,
      body: '',
    };
  }

  return {
    statusCode: 405,
    headers: JSON_HEADERS,
    body: JSON.stringify({ error: 'Method not allowed' }),
  };
}

/**
 * Handle POST /api/recurring/generate.
 */
async function handleGenerate(method, rawBody, client) {
  if (method !== 'POST') {
    return {
      statusCode: 405,
      headers: JSON_HEADERS,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

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

  if (!body || !body.startDate || !body.endDate) {
    return {
      statusCode: 400,
      headers: JSON_HEADERS,
      body: JSON.stringify({ error: 'startDate and endDate are required' }),
    };
  }

  // Validate date format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(body.startDate) || !dateRegex.test(body.endDate)) {
    return {
      statusCode: 400,
      headers: JSON_HEADERS,
      body: JSON.stringify({ error: 'startDate and endDate must be in YYYY-MM-DD format' }),
    };
  }

  // Validate endDate >= startDate
  if (body.endDate < body.startDate) {
    return {
      statusCode: 400,
      headers: JSON_HEADERS,
      body: JSON.stringify({ error: 'endDate must be greater than or equal to startDate' }),
    };
  }

  // Validate date range does not exceed 90 days
  const start = new Date(body.startDate + 'T00:00:00Z');
  const end = new Date(body.endDate + 'T00:00:00Z');
  const diffDays = Math.round((end - start) / (1000 * 60 * 60 * 24));
  if (diffDays > 90) {
    return {
      statusCode: 400,
      headers: JSON_HEADERS,
      body: JSON.stringify({ error: 'Date range must not exceed 90 days' }),
    };
  }

  const result = await generateRecurringTasks(client, body.startDate, body.endDate);
  return {
    statusCode: 200,
    headers: JSON_HEADERS,
    body: JSON.stringify({ generated: result.generated, skipped: result.skipped }),
  };
}

module.exports = { handleRecurringRoutes };
