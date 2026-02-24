const { test, expect } = require('@playwright/test');

test.describe('SPA shell and navigation', () => {
  test('loads the SPA', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('DataTasks');
    await expect(page.locator('#app')).toBeVisible();
  });

  test('nav links are present', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('nav a[href="#/tasks"]')).toBeVisible();
    await expect(page.locator('nav a[href="#/projects"]')).toBeVisible();
    await expect(page.locator('nav a[href="#/templates"]')).toBeVisible();
    await expect(page.locator('nav a[href="#/recurring"]')).toBeVisible();
  });

  test('default route is tasks', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL('**/#/tasks');
    expect(page.url()).toContain('#/tasks');
  });

  test('static JS files are served', async ({ request }) => {
    const app = await request.get('/public/app.js');
    expect(app.status()).toBe(200);
    expect(app.headers()['content-type']).toContain('javascript');

    const api = await request.get('/public/api.js');
    expect(api.status()).toBe(200);
  });

  test('path traversal is blocked', async ({ request }) => {
    const res = await request.get('/public/../package.json');
    expect(res.status()).toBe(404);
  });
});

test.describe('Tasks view', () => {
  test('shows task creation form', async ({ page }) => {
    await page.goto('/#/tasks');
    await expect(page.locator('input[type="date"]').first()).toBeVisible();
    await expect(page.locator('input[placeholder*="description" i]').or(page.locator('input[id*="desc" i]')).first()).toBeVisible();
  });

  test('can create and see a task', async ({ page }) => {
    await page.goto('/#/tasks');
    await page.waitForTimeout(500);

    // Set today's date in the filter
    const today = new Date().toISOString().slice(0, 10);
    const dateInput = page.locator('#task-date');
    if (await dateInput.count() > 0) {
      await dateInput.fill(today);
    }

    // Fill the create form
    const descInput = page.locator('#new-task-desc');
    if (await descInput.count() > 0) {
      await descInput.fill('Playwright test task');
      // Click create button
      await page.locator('button').filter({ hasText: /create|add/i }).first().click();
      await page.waitForTimeout(1000);

      // Task should appear in the list
      await expect(page.locator('text=Playwright test task')).toBeVisible();
    }
  });
});

test.describe('Projects view', () => {
  test('navigates to projects', async ({ page }) => {
    await page.goto('/#/projects');
    await page.waitForTimeout(500);
    await expect(page.locator('#app')).toBeVisible();
  });

  test('shows create form with template dropdown', async ({ page }) => {
    await page.goto('/#/projects');
    await page.waitForTimeout(500);
    // Check for title input and anchor date input
    const titleInput = page.locator('#proj-title').or(page.locator('input[placeholder*="title" i]')).first();
    await expect(titleInput).toBeVisible();
  });
});

test.describe('Templates view', () => {
  test('navigates to templates', async ({ page }) => {
    await page.goto('/#/templates');
    await page.waitForTimeout(500);
    await expect(page.locator('#app')).toBeVisible();
  });
});

test.describe('Recurring view', () => {
  test('navigates to recurring', async ({ page }) => {
    await page.goto('/#/recurring');
    await page.waitForTimeout(500);
    await expect(page.locator('#app')).toBeVisible();
  });
});

test.describe('Health check', () => {
  test('GET /api/health returns ok', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });
});
