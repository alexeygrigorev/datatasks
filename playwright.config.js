const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
  },
  webServer: {
    command: 'IS_LOCAL=true tsx scripts/dev-server.ts',
    port: 3000,
    reuseExistingServer: true,
    timeout: 10000,
  },
});
