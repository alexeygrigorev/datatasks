const http = require('http');
const { URL } = require('url');
const { handler } = require('../src/handler');

const PORT = parseInt(process.env.PORT, 10) || 3000;

const server = http.createServer(async (req, res) => {
  const parsed = new URL(req.url, `http://localhost:${PORT}`);

  // Collect body
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const body = chunks.length > 0 ? Buffer.concat(chunks).toString() : null;

  // Build query string parameters
  const queryStringParameters = {};
  for (const [key, value] of parsed.searchParams.entries()) {
    queryStringParameters[key] = value;
  }

  // Build Lambda-style event
  const event = {
    httpMethod: req.method,
    path: parsed.pathname,
    headers: req.headers,
    body: body,
    queryStringParameters:
      Object.keys(queryStringParameters).length > 0
        ? queryStringParameters
        : null,
  };

  try {
    const result = await handler(event, {});

    // Set response headers
    if (result.headers) {
      for (const [key, value] of Object.entries(result.headers)) {
        res.setHeader(key, value);
      }
    }

    res.writeHead(result.statusCode);
    res.end(result.body || '');
  } catch (err) {
    console.error('Handler error:', err);
    res.writeHead(500);
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
});

server.listen(PORT, () => {
  console.log(`Dev server listening at http://localhost:${PORT}`);
});

process.on('SIGINT', () => {
  console.log('\nShutting down dev server...');
  server.close(() => {
    process.exit(0);
  });
});
