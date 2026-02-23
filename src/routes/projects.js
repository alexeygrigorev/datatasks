const { getClient } = require('../db/client');
const {
  createProject,
  getProject,
  updateProject,
  deleteProject,
  listProjects,
} = require('../db/projects');
const { getTemplate, instantiateTemplate } = require('../db/templates');
const { listTasksByProject } = require('../db/tasks');

const JSON_HEADERS = { 'Content-Type': 'application/json' };

/**
 * Handle all /api/projects routes.
 *
 * @param {string} path - The request path (e.g. /api/projects, /api/projects/abc-123)
 * @param {string} method - HTTP method (GET, POST, PUT, DELETE)
 * @param {string|null} rawBody - Raw request body string
 * @returns {object|null} Lambda response object, or null if path does not match
 */
async function handleProjectRoutes(path, method, rawBody) {
  // Match /api/projects paths
  if (!path.startsWith('/api/projects')) {
    return null;
  }

  const client = await getClient();

  try {
    // Parse the path segments after /api/projects
    const suffix = path.slice('/api/projects'.length);
    // suffix is '', '/', '/:id', '/:id/tasks'

    // Route: /api/projects (collection)
    if (suffix === '' || suffix === '/') {
      return await handleCollection(method, rawBody, client);
    }

    // Route: /api/projects/:id/tasks
    const tasksMatch = suffix.match(/^\/([^/]+)\/tasks\/?$/);
    if (tasksMatch) {
      const id = tasksMatch[1];
      return await handleProjectTasks(method, id, client);
    }

    // Route: /api/projects/:id
    const idMatch = suffix.match(/^\/([^/]+)\/?$/);
    if (idMatch) {
      const id = idMatch[1];
      return await handleSingle(method, id, rawBody, client);
    }

    // No match within /api/projects
    return {
      statusCode: 404,
      headers: JSON_HEADERS,
      body: JSON.stringify({ error: 'Not found' }),
    };
  } catch (err) {
    console.error('Project route error:', err);
    return {
      statusCode: 500,
      headers: JSON_HEADERS,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}

/**
 * Handle /api/projects collection routes (GET list, POST create).
 */
async function handleCollection(method, rawBody, client) {
  if (method === 'GET') {
    const projects = await listProjects(client);
    return {
      statusCode: 200,
      headers: JSON_HEADERS,
      body: JSON.stringify({ projects }),
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
    if (!body.title || typeof body.title !== 'string' || body.title.trim() === '') {
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
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.anchorDate)) {
      return {
        statusCode: 400,
        headers: JSON_HEADERS,
        body: JSON.stringify({ error: 'Invalid anchorDate format, expected YYYY-MM-DD' }),
      };
    }

    // If templateId is provided, verify template exists before creating project
    if (body.templateId) {
      const template = await getTemplate(client, body.templateId);
      if (!template) {
        return {
          statusCode: 404,
          headers: JSON_HEADERS,
          body: JSON.stringify({ error: 'Template not found' }),
        };
      }
    }

    // Build project data
    const projectData = {
      title: body.title,
      anchorDate: body.anchorDate,
    };
    if (body.description !== undefined) {
      projectData.description = body.description;
    }
    if (body.templateId !== undefined) {
      projectData.templateId = body.templateId;
    }

    const project = await createProject(client, projectData);

    // If templateId provided, instantiate the template
    if (body.templateId) {
      const tasks = await instantiateTemplate(
        client,
        body.templateId,
        project.id,
        body.anchorDate
      );
      return {
        statusCode: 201,
        headers: JSON_HEADERS,
        body: JSON.stringify({ project, tasks }),
      };
    }

    return {
      statusCode: 201,
      headers: JSON_HEADERS,
      body: JSON.stringify({ project }),
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
 * Handle /api/projects/:id single resource routes (GET, PUT, DELETE).
 */
async function handleSingle(method, id, rawBody, client) {
  if (method === 'GET') {
    const project = await getProject(client, id);
    if (!project) {
      return {
        statusCode: 404,
        headers: JSON_HEADERS,
        body: JSON.stringify({ error: 'Project not found' }),
      };
    }
    return {
      statusCode: 200,
      headers: JSON_HEADERS,
      body: JSON.stringify({ project }),
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

    // Check project exists
    const existing = await getProject(client, id);
    if (!existing) {
      return {
        statusCode: 404,
        headers: JSON_HEADERS,
        body: JSON.stringify({ error: 'Project not found' }),
      };
    }

    // Only allow updating known fields
    const allowedFields = ['title', 'description', 'anchorDate'];
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

    const project = await updateProject(client, id, updates);
    return {
      statusCode: 200,
      headers: JSON_HEADERS,
      body: JSON.stringify({ project }),
    };
  }

  if (method === 'DELETE') {
    const existing = await getProject(client, id);
    if (!existing) {
      return {
        statusCode: 404,
        headers: JSON_HEADERS,
        body: JSON.stringify({ error: 'Project not found' }),
      };
    }

    await deleteProject(client, id);
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
 * Handle /api/projects/:id/tasks sub-route (GET only).
 */
async function handleProjectTasks(method, id, client) {
  if (method !== 'GET') {
    return {
      statusCode: 405,
      headers: JSON_HEADERS,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  // Check project exists
  const project = await getProject(client, id);
  if (!project) {
    return {
      statusCode: 404,
      headers: JSON_HEADERS,
      body: JSON.stringify({ error: 'Project not found' }),
    };
  }

  const tasks = await listTasksByProject(client, id);
  return {
    statusCode: 200,
    headers: JSON_HEADERS,
    body: JSON.stringify({ tasks }),
  };
}

module.exports = { handleProjectRoutes };
