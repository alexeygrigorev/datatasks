/**
 * Playwright global setup.
 *
 * Logs in as Grace and saves the auth state (localStorage) to a file.
 * The auth state is then loaded by all browser tests via storageState.
 */

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const AUTH_STATE_PATH = path.join(__dirname, '.auth-state.json');

module.exports = async function globalSetup(config) {
  // Wait for the dev server to be ready
  const baseURL = config.projects[0].use.baseURL || 'http://localhost:3000';

  // Use a browser to get the token and save localStorage state
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ baseURL });

  try {
    // Try to login via the API
    const response = await page.request.post('/api/auth/login', {
      data: { email: 'grace@datatalks.club', password: '111' },
    });

    if (response.status() === 200) {
      const { token, user } = await response.json();

      // Navigate to the app and set localStorage
      await page.goto('/');
      await page.evaluate((args) => {
        localStorage.setItem(args.tokenKey, args.token);
        localStorage.setItem(args.userKey, JSON.stringify(args.user));
      }, {
        tokenKey: 'datatasks_token',
        userKey: 'datatasks_user',
        token,
        user,
      });

      // Save the storage state
      await page.context().storageState({ path: AUTH_STATE_PATH });
      console.log('[global-setup] Auth state saved with token for Grace');
    } else {
      console.warn('[global-setup] Login failed with status', response.status(), '- tests may fail');
    }
  } catch (err) {
    console.warn('[global-setup] Could not set up auth state:', err.message);
  } finally {
    await browser.close();
  }
};
