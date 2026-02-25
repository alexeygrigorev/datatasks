const { test, expect } = require('@playwright/test');

// Helper to archive and delete a bundle
async function archiveAndDelete(request, bundleId) {
  await request.put(`/api/bundles/${bundleId}/archive`);
  await request.delete(`/api/bundles/${bundleId}`);
}

// Generate unique suffix for test isolation
function uid() {
  return Math.random().toString(36).slice(2, 8);
}

test.describe('Bundle detail view (issue #27)', () => {

  // ── Scenario: Grace views a bundle with references and bundle links ──
  test.describe('Scenario: Grace views a bundle with references and bundle links', () => {
    let bundleId;
    const suffix = uid();

    test.beforeAll(async ({ request }) => {
      const res = await request.post('/api/bundles', {
        data: {
          title: 'Weekly email ' + suffix,
          anchorDate: '2026-04-15',
          emoji: '\u{1F4F0}',
          stage: 'preparation',
          references: [
            { name: 'Process docs', url: 'https://docs.google.com/proc' },
          ],
          bundleLinks: [
            { name: 'Luma', url: '' },
            { name: 'YouTube', url: 'https://youtube.com/x' },
          ],
        },
      });
      expect(res.status()).toBe(201);
      const body = await res.json();
      bundleId = body.bundle.id;
    });

    test.afterAll(async ({ request }) => {
      if (bundleId) {
        await archiveAndDelete(request, bundleId);
      }
    });

    test('shows emoji + title, anchor date, stage badge, progress badge, references, and bundle links', async ({ page }) => {
      // Navigate to bundles page
      await page.goto('/#/bundles');
      await page.waitForSelector('.bundle-card');

      // Click on the bundle card to go to detail
      const card = page.locator('.bundle-card', { hasText: 'Weekly email ' + suffix });
      await card.locator('.bundle-card-title').click();

      // Wait for bundle detail to load
      await page.waitForSelector('[data-testid="stage-badge"]');

      // Header: emoji + title
      const header = page.locator('.bundle-detail-header h2');
      await expect(header).toContainText('Weekly email ' + suffix);

      // Anchor date badge
      const anchorBadge = page.locator('.badge-anchor-date');
      await expect(anchorBadge).toHaveText('2026-04-15');

      // Stage badge
      const stageBadge = page.locator('[data-testid="stage-badge"]');
      await expect(stageBadge).toHaveText('preparation');
      await expect(stageBadge).toHaveClass(/preparation/);

      // Progress badge
      const progressBadge = page.locator('[data-testid="progress-badge"]');
      await expect(progressBadge).toContainText('done');

      // References section: "Process docs" as clickable read-only link
      const refsSection = page.locator('.references-section');
      await expect(refsSection).toBeVisible();
      const refLink = refsSection.locator('.reference-link');
      await expect(refLink).toHaveText('Process docs');
      await expect(refLink).toHaveAttribute('href', 'https://docs.google.com/proc');
      await expect(refLink).toHaveAttribute('target', '_blank');

      // Bundle links section: "Luma" with empty input, "YouTube" with pre-filled URL
      const blSection = page.locator('.bundle-links-editable');
      await expect(blSection).toBeVisible();

      const linkRows = blSection.locator('.bundle-link-row');
      expect(await linkRows.count()).toBe(2);

      // Luma row: empty input
      const lumaRow = linkRows.nth(0);
      await expect(lumaRow.locator('.bundle-link-label')).toHaveText('Luma');
      await expect(lumaRow.locator('.bundle-link-url-input')).toHaveValue('');

      // YouTube row: pre-filled
      const ytRow = linkRows.nth(1);
      await expect(ytRow.locator('.bundle-link-label')).toHaveText('YouTube');
      await expect(ytRow.locator('.bundle-link-url-input')).toHaveValue('https://youtube.com/x');
    });
  });

  // ── Scenario: Grace fills in a required link on a task ──
  test.describe('Scenario: Grace fills in a required link on a task', () => {
    let bundleId;
    let taskId;
    const suffix = uid();

    test.beforeAll(async ({ request }) => {
      // Create bundle with Luma bundle link
      const bundleRes = await request.post('/api/bundles', {
        data: {
          title: 'Event ' + suffix,
          anchorDate: '2026-05-01',
          bundleLinks: [{ name: 'Luma', url: '' }],
        },
      });
      expect(bundleRes.status()).toBe(201);
      const bundleBody = await bundleRes.json();
      bundleId = bundleBody.bundle.id;

      // Create task with requiredLinkName
      const taskRes = await request.post('/api/tasks', {
        data: {
          description: 'Create event on Luma ' + suffix,
          date: '2026-05-01',
          bundleId: bundleId,
          requiredLinkName: 'Luma',
          source: 'template',
        },
      });
      expect(taskRes.status()).toBe(201);
      const taskBody = await taskRes.json();
      taskId = taskBody.id;
    });

    test.afterAll(async ({ request }) => {
      if (taskId) {
        await request.delete('/api/tasks/' + taskId);
      }
      if (bundleId) {
        await archiveAndDelete(request, bundleId);
      }
    });

    test('task checkbox is disabled when required link is empty, becomes enabled after filling', async ({ page }) => {
      await page.goto('/#/bundles');
      await page.waitForSelector('.bundle-card');

      const card = page.locator('.bundle-card', { hasText: 'Event ' + suffix });
      await expect(card).toBeVisible({ timeout: 10000 });
      await card.locator('.bundle-card-title').click();

      await page.waitForSelector('[data-testid="stage-badge"]', { timeout: 10000 });

      // Find the task row
      const taskRow = page.locator('[data-task-row="' + taskId + '"]');
      await expect(taskRow).toBeVisible();

      // Checkbox should be disabled since link is empty
      const checkbox = taskRow.locator('.task-status-checkbox');
      await expect(checkbox).toBeDisabled();

      // Required link label
      const linkLabel = taskRow.locator('.required-link-label');
      await expect(linkLabel).toHaveText('Luma:');

      // Fill in the required link
      const linkInput = taskRow.locator('.required-link-input');
      await linkInput.fill('https://lu.ma/abc');

      // Click save
      const saveBtn = taskRow.locator('[data-save-required-link]');
      await saveBtn.click();

      // Wait for the page to reload
      await page.waitForSelector('[data-testid="stage-badge"]');

      // After reload, the checkbox should now be enabled
      const updatedTaskRow = page.locator('[data-task-row="' + taskId + '"]');
      const updatedCheckbox = updatedTaskRow.locator('.task-status-checkbox');
      await expect(updatedCheckbox).toBeEnabled();

      // The input should have the URL filled
      const updatedInput = updatedTaskRow.locator('.required-link-input');
      await expect(updatedInput).toHaveValue('https://lu.ma/abc');

      // Also verify the bundle link was updated via API
      const bundleRes = await page.request.get('/api/bundles/' + bundleId);
      const bundleData = await bundleRes.json();
      const lumaLink = bundleData.bundle.bundleLinks.find(function (l) { return l.name === 'Luma'; });
      expect(lumaLink.url).toBe('https://lu.ma/abc');
    });
  });

  // ── Scenario: Grace changes the bundle stage ──
  test.describe('Scenario: Grace changes the bundle stage', () => {
    let bundleId;
    const suffix = uid();

    test.beforeAll(async ({ request }) => {
      const res = await request.post('/api/bundles', {
        data: {
          title: 'Stage test ' + suffix,
          anchorDate: '2026-06-01',
          stage: 'preparation',
        },
      });
      expect(res.status()).toBe(201);
      const body = await res.json();
      bundleId = body.bundle.id;
    });

    test.afterAll(async ({ request }) => {
      if (bundleId) {
        await archiveAndDelete(request, bundleId);
      }
    });

    test('clicking stage transition button changes the stage', async ({ page }) => {
      await page.goto('/#/bundles');
      await page.waitForSelector('.bundle-card');

      const card = page.locator('.bundle-card', { hasText: 'Stage test ' + suffix });
      await card.locator('.bundle-card-title').click();

      await page.waitForSelector('[data-testid="stage-badge"]');

      // Stage should be "preparation"
      const stageBadge = page.locator('[data-testid="stage-badge"]');
      await expect(stageBadge).toHaveText('preparation');

      // Click "Mark Announced" button
      const stageBtn = page.locator('[data-testid="stage-transition-btn"]');
      await expect(stageBtn).toHaveText('Mark Announced');
      await stageBtn.click();

      // Wait for reload - stage should now be "announced"
      await page.waitForFunction(() => {
        const badge = document.querySelector('[data-testid="stage-badge"]');
        return badge && badge.textContent === 'announced';
      });

      const updatedStageBadge = page.locator('[data-testid="stage-badge"]');
      await expect(updatedStageBadge).toHaveText('announced');

      // The transition button should now say "Mark After-Event"
      const updatedStageBtn = page.locator('[data-testid="stage-transition-btn"]');
      await expect(updatedStageBtn).toHaveText('Mark After-Event');

      // Verify via API
      const res = await page.request.get('/api/bundles/' + bundleId);
      const data = await res.json();
      expect(data.bundle.stage).toBe('announced');
    });
  });

  // ── Scenario: Grace completes a task in the bundle ──
  test.describe('Scenario: Grace completes a task in the bundle', () => {
    let bundleId;
    let taskId;
    const suffix = uid();

    test.beforeAll(async ({ request }) => {
      const bundleRes = await request.post('/api/bundles', {
        data: {
          title: 'Complete task ' + suffix,
          anchorDate: '2026-07-01',
        },
      });
      expect(bundleRes.status()).toBe(201);
      const bundleBody = await bundleRes.json();
      bundleId = bundleBody.bundle.id;

      const taskRes = await request.post('/api/tasks', {
        data: {
          description: 'Send invites ' + suffix,
          date: '2026-07-01',
          bundleId: bundleId,
          source: 'template',
        },
      });
      expect(taskRes.status()).toBe(201);
      const taskBody = await taskRes.json();
      taskId = taskBody.id;
    });

    test.afterAll(async ({ request }) => {
      if (taskId) {
        await request.delete('/api/tasks/' + taskId);
      }
      if (bundleId) {
        await archiveAndDelete(request, bundleId);
      }
    });

    test('checking a task checkbox marks it done and updates progress badge', async ({ page }) => {
      await page.goto('/#/bundles');
      await page.waitForSelector('.bundle-card');

      const card = page.locator('.bundle-card', { hasText: 'Complete task ' + suffix });
      await card.locator('.bundle-card-title').click();

      await page.waitForSelector('[data-testid="stage-badge"]');

      // Progress should show 0/1 done
      const progressBadge = page.locator('[data-testid="progress-badge"]');
      await expect(progressBadge).toHaveText('0/1 done');

      // Check the task checkbox
      const checkbox = page.locator('[data-task-checkbox="' + taskId + '"]');
      await expect(checkbox).not.toBeChecked();
      await checkbox.check();

      // Wait for reload
      await page.waitForFunction(() => {
        const badge = document.querySelector('[data-testid="progress-badge"]');
        return badge && badge.textContent === '1/1 done';
      });

      // Progress should now show 1/1 done
      const updatedProgress = page.locator('[data-testid="progress-badge"]');
      await expect(updatedProgress).toHaveText('1/1 done');

      // Task row should have task-done class
      const taskRow = page.locator('[data-task-row="' + taskId + '"]');
      await expect(taskRow).toHaveClass(/task-done/);
    });
  });

  // ── Scenario: Grace adds a custom extra link to the bundle ──
  test.describe('Scenario: Grace adds a custom extra link to the bundle', () => {
    let bundleId;
    const suffix = uid();

    test.beforeAll(async ({ request }) => {
      const res = await request.post('/api/bundles', {
        data: {
          title: 'Custom links ' + suffix,
          anchorDate: '2026-08-01',
          bundleLinks: [
            { name: 'Luma', url: '' },
            { name: 'YouTube', url: '' },
          ],
        },
      });
      expect(res.status()).toBe(201);
      const body = await res.json();
      bundleId = body.bundle.id;
    });

    test.afterAll(async ({ request }) => {
      if (bundleId) {
        await archiveAndDelete(request, bundleId);
      }
    });

    test('adds a new link via the add link form', async ({ page }) => {
      await page.goto('/#/bundles');
      await page.waitForSelector('.bundle-card');

      const card = page.locator('.bundle-card', { hasText: 'Custom links ' + suffix });
      await card.locator('.bundle-card-title').click();

      await page.waitForSelector('[data-testid="stage-badge"]');

      // Should see 2 existing link rows
      const blSection = page.locator('.bundle-links-editable');
      let linkRows = blSection.locator('.bundle-link-row');
      expect(await linkRows.count()).toBe(2);

      // Fill in the add link form
      await page.fill('#add-bl-name', 'Spreadsheet');
      await page.fill('#add-bl-url', 'https://docs.google.com/sheet');

      // Click Add
      await page.click('#add-bl-btn');

      // Wait for reload
      await page.waitForFunction(() => {
        const rows = document.querySelectorAll('.bundle-link-row');
        return rows.length === 3;
      });

      // Should now have 3 link rows
      linkRows = page.locator('.bundle-link-row');
      expect(await linkRows.count()).toBe(3);

      // The new row should be "Spreadsheet"
      const newRow = linkRows.nth(2);
      await expect(newRow.locator('.bundle-link-label')).toHaveText('Spreadsheet');
      await expect(newRow.locator('.bundle-link-url-input')).toHaveValue('https://docs.google.com/sheet');

      // Verify via API
      const res = await page.request.get('/api/bundles/' + bundleId);
      const data = await res.json();
      expect(data.bundle.bundleLinks).toHaveLength(3);
      expect(data.bundle.bundleLinks[2].name).toBe('Spreadsheet');
      expect(data.bundle.bundleLinks[2].url).toBe('https://docs.google.com/sheet');
    });
  });

  // ── Scenario: Back button navigates to home dashboard ──
  test.describe('Scenario: Back button navigates to home dashboard (issue #31)', () => {
    let bundleId;
    const suffix = uid();

    test.beforeAll(async ({ request }) => {
      const res = await request.post('/api/bundles', {
        data: {
          title: 'Back btn test ' + suffix,
          anchorDate: '2026-04-20',
        },
      });
      expect(res.status()).toBe(201);
      const body = await res.json();
      bundleId = body.bundle.id;
    });

    test.afterAll(async ({ request }) => {
      if (bundleId) {
        await archiveAndDelete(request, bundleId);
      }
    });

    test('back button label reads "← Back to Home"', async ({ page }) => {
      await page.goto('/#/bundles');
      await page.waitForSelector('.bundle-card');

      const card = page.locator('.bundle-card', { hasText: 'Back btn test ' + suffix });
      await card.locator('.bundle-card-title').click();

      await page.waitForSelector('[data-testid="stage-badge"]');

      const backBtn = page.locator('.btn-back');
      await expect(backBtn).toHaveText('\u2190 Back to Home');
    });

    test('clicking back button navigates to #/', async ({ page }) => {
      await page.goto('/#/bundles');
      await page.waitForSelector('.bundle-card');

      const card = page.locator('.bundle-card', { hasText: 'Back btn test ' + suffix });
      await card.locator('.bundle-card-title').click();

      await page.waitForSelector('[data-testid="stage-badge"]');

      const backBtn = page.locator('.btn-back');
      await backBtn.click();

      // URL hash should now be #/
      await page.waitForFunction(() => location.hash === '#/');
      expect(page.url()).toMatch(/#\/$/);
    });

    test('full round-trip: Home -> bundle card -> bundle detail -> back -> Home', async ({ page }) => {
      // Start at home dashboard
      await page.goto('/#/');
      await page.waitForSelector('.dashboard-bundle-card');

      // Click bundle card from home page
      const card = page.locator('.dashboard-bundle-card', { hasText: 'Back btn test ' + suffix });
      await card.click();

      // Wait for bundle detail
      await page.waitForSelector('[data-testid="stage-badge"]');
      expect(page.url()).toMatch(/#\/bundles/);

      // Click back button
      const backBtn = page.locator('.btn-back');
      await expect(backBtn).toHaveText('\u2190 Back to Home');
      await backBtn.click();

      // Should be back on home dashboard
      await page.waitForFunction(() => location.hash === '#/');
      expect(page.url()).toMatch(/#\/$/);

      // Home dashboard should be visible (bundle cards column)
      await page.waitForSelector('.dashboard-bundle-card');
    });

    test('visiting #/bundles after back-to-home shows list, not stale detail', async ({ page }) => {
      // Navigate to bundle detail
      await page.goto('/#/bundles');
      await page.waitForSelector('.bundle-card');

      const card = page.locator('.bundle-card', { hasText: 'Back btn test ' + suffix });
      await card.locator('.bundle-card-title').click();
      await page.waitForSelector('[data-testid="stage-badge"]');

      // Click back to home
      const backBtn = page.locator('.btn-back');
      await backBtn.click();
      await page.waitForFunction(() => location.hash === '#/');

      // Now navigate to #/bundles via hash
      await page.goto('/#/bundles');
      await page.waitForSelector('.bundle-card');

      // Should show bundles list, not a stale bundle detail
      const stageBadge = page.locator('[data-testid="stage-badge"]');
      await expect(stageBadge).not.toBeVisible();
      const bundleCards = page.locator('.bundle-card');
      expect(await bundleCards.count()).toBeGreaterThan(0);
    });
  });

  // ── Tasks table: instructions URL, assignee, no comments ──
  test.describe('Tasks table features', () => {
    let bundleId;
    let taskWithInstr;
    let taskPlain;
    const suffix = uid();

    test.beforeAll(async ({ request }) => {
      // Create users (seed should already have them, but just in case)
      const bundleRes = await request.post('/api/bundles', {
        data: {
          title: 'TaskTable ' + suffix,
          anchorDate: '2026-09-01',
        },
      });
      expect(bundleRes.status()).toBe(201);
      bundleId = (await bundleRes.json()).bundle.id;

      // Create task with instructionsUrl
      const res1 = await request.post('/api/tasks', {
        data: {
          description: 'InstrTask ' + suffix,
          date: '2026-09-01',
          bundleId: bundleId,
          instructionsUrl: 'https://docs.google.com/instructions',
          source: 'template',
        },
      });
      expect(res1.status()).toBe(201);
      taskWithInstr = await res1.json();

      // Create a plain task
      const res2 = await request.post('/api/tasks', {
        data: {
          description: 'PlainTask ' + suffix,
          date: '2026-09-02',
          bundleId: bundleId,
          source: 'template',
          comment: 'This comment should not be shown',
        },
      });
      expect(res2.status()).toBe(201);
      taskPlain = await res2.json();
    });

    test.afterAll(async ({ request }) => {
      if (taskWithInstr) await request.delete('/api/tasks/' + taskWithInstr.id);
      if (taskPlain) await request.delete('/api/tasks/' + taskPlain.id);
      if (bundleId) await archiveAndDelete(request, bundleId);
    });

    test('shows instructions URL as link icon and does not show comments', async ({ page }) => {
      await page.goto('/#/bundles');
      await page.waitForSelector('.bundle-card');

      const card = page.locator('.bundle-card', { hasText: 'TaskTable ' + suffix });
      await card.locator('.bundle-card-title').click();

      await page.waitForSelector('[data-testid="stage-badge"]');

      // Task with instructions should have an instructions link
      const instrRow = page.locator('[data-task-row="' + taskWithInstr.id + '"]');
      await expect(instrRow).toBeVisible();
      const instrLink = instrRow.locator('.instructions-link');
      await expect(instrLink).toBeVisible();
      await expect(instrLink).toHaveAttribute('href', 'https://docs.google.com/instructions');
      await expect(instrLink).toHaveAttribute('target', '_blank');

      // Comments column should NOT exist in the table
      const table = page.locator('.bundle-tasks-table');
      await expect(table).toBeVisible();
      const headers = table.locator('th');
      const headerTexts = await headers.allTextContents();
      expect(headerTexts.join(',')).not.toContain('Comment');
    });
  });
});
