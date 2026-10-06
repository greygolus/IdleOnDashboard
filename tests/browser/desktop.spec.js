const { test, expect } = require('@playwright/test');
const { execFileSync } = require('node:child_process');
const P = 'idleon-dashboard-';
const desktopSizes = [[1200, 640], [1280, 720], [1366, 768], [1440, 900], [1920, 1080]];
const mainPanels = ['.hero', '#toolsSection', '#currentIntel', '#checklistSection', '.side-panel [data-side-id="links"]', '.side-panel [data-side-id="controls"]', '.side-panel [data-side-id="saved"]', '#toolboxPanel', '.side-panel [data-side-id="manual"]', '#notesPanel'];

async function prepare(page, values = {}) {
  await page.clock.install({ time: new Date('2026-09-05T12:00:00Z') });
  await page.addInitScript(values => {
    if (!sessionStorage.getItem('desktop-seeded')) {
      Object.entries(values).forEach(([key, value]) => localStorage.setItem(key, value));
      sessionStorage.setItem('desktop-seeded', 'yes');
    }
  }, { [P + 'onboarding-seen']: 'true', 'idleon-dashboard.notice.2026-09-small-updates': 'seen', ...values });
  await page.route(/google\.com|idleon\.wiki|_vercel\/insights/, route => route.abort());
  await page.goto('/');
  await expect(page.locator('#toolGrid .tool-card').first()).toBeVisible();
}

async function expectDesktopFit(page) {
  expect(await page.evaluate(() => ({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight }))).toEqual(await page.evaluate(() => ({ width: innerWidth, height: innerHeight })));
  for (const selector of mainPanels) await expect(page.locator(selector)).toBeInViewport({ ratio: 1 });
  const overflow = await page.locator('.shell, .workspace, #toolGrid, #rotationGrid, .rotation-card, .rate-card, .checklist-card, #checklistList, .side-panel, .side-panel section').evaluateAll(elements => elements.filter(e => e.scrollWidth > e.clientWidth + 2 || (e.scrollHeight > e.clientHeight + 2 && !['auto', 'scroll'].includes(getComputedStyle(e).overflowY))).map(e => e.id || e.className));
  expect(overflow).toEqual([]);
}

for (const [width, height] of desktopSizes) {
  test(`desktop panels and primary controls fit one screen at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await prepare(page);
    await expectDesktopFit(page);
    for (const selector of ['#resourceSearch', '#resourceCategory', '#checklistForm', '#rateValue', '#rateUnit', '#rateResults', '#toolboxUsername', '#fetchProfileData', '#copyRawJson', '#pasteManualJson', '#openManualJson', '#clearManualJson', '#notes']) {
      await expect(page.locator(selector)).toBeInViewport({ ratio: 1 });
    }
    if (height >= 768) {
      await expect(page.locator('#toolGrid .tool-card')).toHaveCount(10);
      for (const card of await page.locator('#toolGrid .tool-card').all()) await expect(card).toBeInViewport({ ratio: 1 });
    }
    await expect(page.getByRole('textbox', { name: 'Amount', exact: true })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Per', exact: true })).toBeVisible();
    await page.locator('#rateValue').fill('2.5M');
    await expect(page.locator('#rateResults')).toContainText('150M');
    await page.mouse.move(5, 5);
    await page.mouse.wheel(0, 2000);
    expect(await page.evaluate(() => scrollY)).toBe(0);
    await page.locator('#resourceSearch').fill('wiki');
    await expect(page.getByRole('button', { name: 'Clear filters', exact: true })).toBeInViewport({ ratio: 1 });
    await expectDesktopFit(page);
  });
}

test('upgrading and resizing preserve saved data while long panels remain usable', async ({ page }) => {
  const links = Array.from({ length: 36 }, (_, n) => ({ id: `mine-${n}`, name: n === 35 ? 'VeryLongUnbrokenSavedResourceName'.repeat(8) : `My resource ${n}`, url: `https://example.com/resource/${n}`, personalUrl: `https://example.com/my-copy/${n}?x=1#tab`, type: 'manual', favorite: true, inControls: true, showInTools: true, showInSavedPanel: true, extra: { preserve: n } }));
  const items = Array.from({ length: 70 }, (_, n) => ({ id: `task-${n}`, text: `My task ${n}`, type: 'current', done: false, extra: n }));
  const layout = { tools: { compact: false, hidden: [], order: ['idleon-wiki', 'saved-link-mine-0', 'future-resource'], sizes: {}, extra: 'keep' }, sidebar: { order: ['manual', 'saved', 'controls', 'toolbox', 'links'], extra: 2 }, future: { preserve: true } };
  const oldStyles = execFileSync('git', ['show', '8bd6d62:styles.css'], { encoding: 'utf8' });
  await page.route('**/styles.css', route => route.fulfill({ body: oldStyles, contentType: 'text/css' }));
  await prepare(page, { [P + 'saved-links']: JSON.stringify(links), [P + 'checklist-items']: JSON.stringify(items), [P + 'layout']: JSON.stringify(layout), [P + 'notes']: 'My exact notes\n'.repeat(100) });
  const raw = () => page.evaluate(P => Object.fromEntries(Object.entries(localStorage).filter(([key]) => key.startsWith(P) && !key.startsWith(P + 'recovery-'))), P);
  const before = await raw();
  await page.unroute('**/styles.css');
  await page.reload();
  await expect(page.locator('#toolGrid .tool-card')).toHaveCount(46);
  for (const [width, height] of [...desktopSizes, [390, 844], [960, 540], [1366, 768]]) {
    await page.setViewportSize({ width, height });
    if (width >= 1200) await expectDesktopFit(page);
    else expect(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight && document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await raw()).toEqual(before);
  }
  const lastLink = page.locator('#toolGrid [data-card-id="saved-link-mine-35"] .primary-action');
  await lastLink.scrollIntoViewIfNeeded();
  await expect(lastLink).toBeInViewport({ ratio: 1 });
  await expect(lastLink).toHaveAttribute('href', links[35].personalUrl);
  const lastTask = page.getByRole('checkbox', { name: 'My task 69', exact: true });
  await lastTask.scrollIntoViewIfNeeded();
  await expect(lastTask).toBeInViewport({ ratio: 1 });
  await page.locator('#notes').focus();
  await page.keyboard.press('Control+End');
  expect(await page.locator('#notes').evaluate(e => e.scrollTop)).toBeGreaterThan(0);
  expect(await page.evaluate(() => scrollY)).toBe(0);
  expect(await raw()).toEqual(before);
});
