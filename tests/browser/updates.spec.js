const { test, expect } = require('@playwright/test');
const { execFileSync } = require('node:child_process');
const P = 'idleon-dashboard-';
const NOTICE = 'idleon-dashboard.notice.2026-09-small-updates';
const existingData = {
  [P + 'onboarding-seen']: 'true',
  [P + 'notes']: 'Keep my notes\n  and exact spacing',
  [P + 'saved-links']: JSON.stringify([{ id: 'personal', name: 'My sheet', url: 'https://example.com/original', personalUrl: 'https://example.com/mine?x=1#tab', type: 'sheet', favorite: true, extra: { keep: 1 } }]),
  [P + 'layout']: '{"tools":{"compact":true,"hidden":[],"order":["idleon-wiki","unknown"]},"future":{"keep":true}}'
};
const savedData = page => page.evaluate(P => Object.fromEntries(Object.entries(localStorage).filter(([key]) => key.startsWith(P) && !key.startsWith(P + 'recovery-'))), P);
async function prepare(page, values = {}) {
  await page.clock.install({ time: new Date('2026-09-10T12:00:00Z') });
  await page.addInitScript(values => {
    if (!sessionStorage.getItem('update-test-seeded')) {
      Object.entries(values).forEach(([key, value]) => localStorage.setItem(key, value));
      sessionStorage.setItem('update-test-seeded', 'yes');
    }
  }, values);
  await page.route(/google\.com|idleon\.wiki|_vercel\/insights/, route => route.abort());
  await page.goto('/');
  await expect(page.locator('#toolGrid .tool-card').first()).toBeVisible();
}

test('community links use the real logos and fill the second-to-last slot', async ({ page }) => {
  await prepare(page, { ...existingData, [NOTICE]: 'seen' });
  const icons = page.locator('#wikiLinks > *');
  await expect(icons).toHaveCount(12);
  await expect(icons.nth(8)).toHaveAttribute('href', 'https://steamdb.info/app/1476970/');
  await expect(icons.nth(8).locator('img')).toHaveAttribute('src', 'assets/brands/steamdb-logo.svg');
  await expect(icons.nth(6).locator('img')).not.toHaveAttribute('src', 'assets/brands/steamdb-logo.svg');
  await expect(icons.nth(10)).toHaveAttribute('href', 'https://greygolus.com/');
  await expect(icons.nth(10)).toHaveAttribute('target', '_blank');
  await expect(icons.nth(10).locator('img')).toHaveAttribute('alt', 'Grey Golus · greygolus.com');
  for (const icon of [icons.nth(8), icons.nth(10)]) {
    await expect.poll(() => icon.locator('img').evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  }
  await expect(icons.nth(11)).toHaveAttribute('title', 'RIP Tools');
});

for (const dismissal of ['button', 'Escape', 'backdrop', 'reload']) {
  test(`existing users see the notice only once after ${dismissal}`, async ({ page }) => {
    const oldApp = execFileSync('git', ['show', 'db281c3:app.js'], { encoding: 'utf8' });
    await page.route('**/app.js', route => route.fulfill({ body: oldApp, contentType: 'text/javascript' }));
    await prepare(page, existingData);
    const before = await savedData(page);
    await page.unroute('**/app.js');
    await page.reload();
    const dialog = page.locator('#updateNoticeModal');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("I've made a few small updates to IdleOn Dashboard.");
    await expect(dialog).toContainText('gyerg');
    await expect(page.locator('dialog[open]')).toHaveCount(1);
    expect(await savedData(page)).toEqual(before);
    if (dismissal === 'button') await dialog.getByRole('button', { name: 'Got it', exact: true }).click();
    else if (dismissal === 'Escape') await page.keyboard.press('Escape');
    else if (dismissal === 'backdrop') await page.mouse.click(4, 4);
    else await page.reload();
    await expect(dialog).not.toBeVisible();
    await page.reload();
    await expect(page.locator('#toolGrid .tool-card').first()).toBeVisible();
    await expect(dialog).not.toBeVisible();
    expect(await page.evaluate(key => localStorage.getItem(key), NOTICE)).toBe('seen');
    expect(await savedData(page)).toEqual(before);
  });
}

test('new visitors never get this release notice after onboarding or saving data', async ({ page }) => {
  await prepare(page);
  await expect(page.locator('#onboardingModal')).toBeVisible();
  await expect(page.locator('#updateNoticeModal')).not.toBeVisible();
  expect(await page.evaluate(key => localStorage.getItem(key), NOTICE)).toBe('not-applicable');
  await page.locator('#finishOnboardingModal').click();
  await page.locator('#notes').fill('New visitor notes');
  await page.reload();
  await expect(page.locator('#notes')).toHaveValue('New visitor notes');
  await expect(page.locator('#updateNoticeModal')).not.toBeVisible();
});

test('existing users without an onboarding preference get only the update notice', async ({ page }) => {
  await prepare(page, { [P + 'notes']: 'My existing notes' });
  await expect(page.locator('#updateNoticeModal')).toBeVisible();
  await expect(page.locator('#onboardingModal')).not.toBeVisible();
  await page.locator('#dismissUpdateNotice').click();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  expect(await page.evaluate(P => localStorage.getItem(P + 'onboarding-seen'), P)).toBeNull();
});

test('a fresh background visit stays excluded after reloading or opening another tab', async ({ page, context }) => {
  await page.addInitScript(() => Object.defineProperty(document, 'hidden', { get: () => true }));
  await prepare(page);
  expect(await page.evaluate(key => localStorage.getItem(key), NOTICE)).toBe('not-applicable');
  await page.reload();
  await expect(page.locator('#toolGrid .tool-card').first()).toBeVisible();
  const other = await context.newPage();
  await other.goto('/');
  await expect(other.locator('#onboardingModal')).toBeVisible();
  await expect(other.locator('#updateNoticeModal')).not.toBeVisible();
});

test('an existing background visitor claims the notice only on becoming visible', async ({ page }) => {
  await page.addInitScript(() => {
    window.noticeTestHidden = true;
    Object.defineProperty(document, 'hidden', { get: () => window.noticeTestHidden });
  });
  await prepare(page, existingData);
  expect(await page.evaluate(key => localStorage.getItem(key), NOTICE)).toBeNull();
  await expect(page.locator('#updateNoticeModal')).not.toBeVisible();
  await page.evaluate(() => { window.noticeTestHidden = false; document.dispatchEvent(new Event('visibilitychange')); });
  await expect(page.locator('#updateNoticeModal')).toBeVisible();
  expect(await page.evaluate(key => localStorage.getItem(key), NOTICE)).toBe('seen');
});

test('simultaneous tabs claim a single notice across the browser profile', async ({ context, page }) => {
  await context.addInitScript(values => Object.entries(values).forEach(([key, value]) => localStorage.setItem(key, value)), existingData);
  await context.route(/google\.com|idleon\.wiki|_vercel\/insights/, route => route.abort());
  const other = await context.newPage();
  await Promise.all([page.goto('/'), other.goto('/')]);
  await expect.poll(async () => (await Promise.all([page, other].map(p => p.locator('#updateNoticeModal').isVisible()))).filter(Boolean).length).toBe(1);
  await Promise.all([page.reload(), other.reload()]);
  for (const tab of [page, other]) {
    await expect(tab.locator('#toolGrid .tool-card').first()).toBeVisible();
    await expect(tab.locator('#updateNoticeModal')).not.toBeVisible();
  }
});

for (const method of ['getItem', 'setItem']) {
  test(`unavailable notice ${method} never blocks the dashboard or repeats a prompt`, async ({ page }) => {
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(({ method, key }) => {
      const original = Storage.prototype[method];
      Storage.prototype[method] = function (name, ...args) {
        if (name === key) throw new DOMException('Test storage unavailable', 'QuotaExceededError');
        return original.call(this, name, ...args);
      };
    }, { method, key: NOTICE });
    await prepare(page, existingData);
    for (let n = 0; n < 2; n++) {
      await expect(page.locator('#updateNoticeModal')).not.toBeVisible();
      await page.locator('#resourceSearch').fill('wiki');
      await expect(page.locator('#toolGrid')).toContainText('Idleon Wiki');
      await page.reload();
      await expect(page.locator('#toolGrid .tool-card').first()).toBeVisible();
    }
    expect(errors).toEqual([]);
  });
}

test('the notice fits a phone and contains keyboard focus', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await prepare(page, existingData);
  const dialog = page.locator('#updateNoticeModal');
  await expect(dialog).toBeInViewport({ ratio: 1 });
  await expect(page.locator('#dismissUpdateNotice')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('#dismissUpdateNotice')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('#dismissUpdateNotice')).toBeFocused();
  expect(await dialog.evaluate(d => d.scrollWidth <= d.clientWidth)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
});
