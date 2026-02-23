const fs = require('fs');
const path = require('path');

async function route(event) {
  const method = event.httpMethod || 'GET';
  const reqPath = event.path || '/';

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

  // GET /api/health — health check
  if (method === 'GET' && reqPath === '/api/health') {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ok' }),
    };
  }

  // Anything else — 404
  return {
    statusCode: 404,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: 'Not found' }),
  };
}

module.exports = { route };
