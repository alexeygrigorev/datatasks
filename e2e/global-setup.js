const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const TEST_SERVER_PORT = 3001;
const READY_TIMEOUT_MS = 30000;
const POLL_INTERVAL_MS = 300;

/**
 * Poll the test server until it responds or timeout is reached.
 */
function waitForServer(port, timeoutMs) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;

    function poll() {
      const req = http.get(
        `http://localhost:${port}/api/tasks?date=2000-01-01`,
        (res) => {
          res.resume(); // discard body
          resolve();
        }
      );
      req.on('error', () => {
        if (Date.now() >= deadline) {
          reject(new Error(`Test server on port ${port} did not start within ${timeoutMs}ms`));
          return;
        }
        setTimeout(poll, POLL_INTERVAL_MS);
      });
      req.setTimeout(1000, () => {
        req.destroy();
        if (Date.now() >= deadline) {
          reject(new Error(`Test server on port ${port} did not start within ${timeoutMs}ms`));
          return;
        }
        setTimeout(poll, POLL_INTERVAL_MS);
      });
    }

    poll();
  });
}

module.exports = async function globalSetup() {
  const serverScript = path.join(__dirname, '..', 'scripts', 'test-server.ts');

  // Use detached: true so the child runs in its own process group.
  // This lets us kill the entire group (parent tsx + child node) cleanly.
  const child = spawn(
    'npx',
    ['tsx', serverScript],
    {
      env: {
        ...process.env,
        NODE_ENV: 'test',
        IS_LOCAL: 'true',
        PORT: String(TEST_SERVER_PORT),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    }
  );

  child.stdout.on('data', (data) => {
    process.stdout.write(`[test-server] ${data}`);
  });
  child.stderr.on('data', (data) => {
    process.stderr.write(`[test-server] ${data}`);
  });

  child.on('exit', (code) => {
    if (code !== null && code !== 0) {
      console.error(`[test-server] exited with code ${code}`);
    }
  });

  // Store the child process so teardown can kill it
  globalThis.__testServerProcess = child;

  // Wait for the server to be ready before returning control to Playwright
  await waitForServer(TEST_SERVER_PORT, READY_TIMEOUT_MS);

  console.log(`[global-setup] Test server is ready on port ${TEST_SERVER_PORT}`);
};
