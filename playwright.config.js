const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: 0,
  globalSetup: './e2e/global-setup.js',
  globalTeardown: './e2e/global-teardown.js',
  use: {
    baseURL: 'http://localhost:3001',
    headless: true,
  },
});
