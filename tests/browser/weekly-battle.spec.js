const { test, expect } = require('@playwright/test');

const P = 'idleon-dashboard-';
const now = new Date('2026-10-06T12:00:00Z');
const sourceUrl = 'https://docs.google.com/spreadsheets/d/1z1P2ouvYhe2pryWoF0kIQE7QichYpJt1GaPPos-e-aw/htmlview?gid=0';
const currentRun = {
  start: '2026-10-01T00:00:00.000Z',
  end: '2026-10-08T00:00:00.000Z',
  boss: 'Mollo Gomm',
  requirements: [
    { name: 'Material Carry Cap', characters: '1, 3, 5, 8, 9, 10' },
    { name: 'Mining lvl', characters: '2, 7' },
    { name: 'Class lvl', characters: '4, 6, 11' }
  ],
  routes: [
    { name: '5 Skulls', lines: ['1 2 2 - 1 1 (FR)', '1 2 1 - 1 3 Skip - 2 3 1 - 3 3 3 - 3'] },
    { name: 'Misc + Trophy', lines: ['3 1 2 - 2 1 (FR)', '3 1 2 - 2 3 Skip - 3 1 3 - 3 3'] }
  ],
  trophies: 3,
  bonuses: [{ name: 'Bonus Class EXP', value: '30%' }, { name: 'Bonus Dmg', value: '15%' }]
};
const savedPreferences = {
  [P + 'notes']: 'My exact notes\n  Keep spacing and Unicode: ★',
  [P + 'favorites']: '["idleon-wiki","idleon-toolbox"]',
  [P + 'saved-links']: JSON.stringify([{ id: 'preset-sampling-skilling-checklist', name: 'My sampling copy', personalUrl: 'https://example.com/my-copy?x=1&y=2#tab', preset: true, type: 'sheet', favorite: true, showInTools: true, inControls: true, extra: { preserve: 1 } }]),
  [P + 'layout']: JSON.stringify({ tools: { compact: true, hidden: ['ie-auto-review'], order: ['idleon-wiki', 'saved-link-preset-sampling-skilling-checklist', 'future-resource', 'idleon-toolbox'], sizes: { 'future-resource': 'wide' }, extra: 'keep' }, intel: { order: ['weekly-battle'], sizes: { 'weekly-battle': 'tall' }, extra: 'keep' }, sidebar: { order: ['saved', 'toolbox', 'links', 'controls', 'manual'] }, future: { preserve: true } }),
  [P + 'checklist-items']: JSON.stringify([{ id: 'my-goal', text: 'Keep my goal', type: 'current', done: false, extra: 'keep' }]),
  [P + 'checklist-settings']: '{"idleonResetTime":"03:45","extra":"keep"}',
  [P + 'toolbox-username']: 'MyPlayer',
  [P + 'account-link']: 'https://idleontoolbox.com/?profile=MyPlayer'
};

async function prepare(page, { run = currentRun, status = 200, time = now, preferences = {} } = {}) {
  let requests = 0;
  await page.clock.install({ time });
  await page.addInitScript(values => {
    if (!sessionStorage.getItem('weekly-battle-seeded')) {
      Object.entries(values).forEach(([key, value]) => localStorage.setItem(key, value));
      sessionStorage.setItem('weekly-battle-seeded', 'yes');
    }
  }, { [P + 'onboarding-seen']: 'true', 'idleon-dashboard.notice.2026-09-small-updates': 'seen', ...preferences });
  await page.route(/google\.com|idleon\.wiki|_vercel\/insights/, route => route.abort());
  await page.route('**/api/weekly-battle', route => {
    requests += 1;
    return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(status === 200 ? { run } : { error: 'Unavailable' }) });
  });
  await page.goto('/');
  await expect(page.locator('.rotation-weekly-battle h3')).toHaveText('Mollo Gomm');
  await expect.poll(() => requests).toBe(1);
  await expect(page.locator('.weekly-battle-guide')).not.toContainText('Loading weekly routes');
  return () => requests;
}

async function expectSavedPreferences(page) {
  const actual = await page.evaluate(keys => Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)])), Object.keys(savedPreferences));
  expect(actual).toEqual(savedPreferences);
}

test('current weekly routes show the sheet details without changing saved preferences', async ({ page }) => {
  await prepare(page, { preferences: savedPreferences });
  const guide = page.locator('.weekly-battle-guide');
  await expect(guide.locator('time')).toHaveText(['01 Oct 2026', '08 Oct 2026']);
  await expect(guide.locator('.weekly-battle-requirements dt')).toHaveText(currentRun.requirements.map(item => item.name));
  await expect(guide.locator('.weekly-battle-requirements dd')).toHaveText(currentRun.requirements.map(item => item.characters));
  await expect(guide.locator('.weekly-battle-route')).toHaveCount(2);
  await expect(guide.locator('.weekly-battle-route p > span')).toHaveText(currentRun.routes.flatMap(route => route.lines));
  await expect(guide.locator('.weekly-battle-route h4').first()).toHaveText('5 Skulls');
  await expect(guide.locator('.weekly-battle-route h4').last()).toContainText('3 trophies');
  await expect(guide.locator('.weekly-battle-bonuses dt')).toHaveText(['Bonus Class EXP', 'Bonus Dmg']);
  await expect(guide.locator('.weekly-battle-bonuses dd')).toHaveText(['30%', '15%']);
  await expect(guide.locator('.weekly-battle-legend')).toContainText('1 / 2 / 3 = top / middle / bottom choice. FR = full rewind.');
  await expect(guide.getByRole('link', { name: 'Open rotation sheet' })).toHaveAttribute('href', sourceUrl);
  await expect(page.locator('.rotation-weekly-battle .mini-list li')).toHaveCount(4);
  await expectSavedPreferences(page);
  await page.reload();
  await expect(page.locator('.weekly-battle-route')).toHaveCount(2);
  await expectSavedPreferences(page);
});

test('an unavailable sheet keeps the current boss and shop items usable', async ({ page }) => {
  await prepare(page, { status: 503 });
  const card = page.locator('.rotation-weekly-battle');
  await expect(card.locator('.mini-list span')).toHaveText(['Magma UI', 'Deadwood UI', 'Power Statue', 'Golden Food']);
  await expect(card.locator('.weekly-battle-route')).toHaveCount(0);
  await expect(card.getByRole('status')).toContainText('Weekly routes are unavailable');
  await expect(card.getByRole('link', { name: 'Open rotation sheet' })).toHaveAttribute('href', sourceUrl);
});

for (const [label, overrides] of [
  ['expired', { start: '2026-09-24T00:00:00.000Z', end: '2026-10-01T00:00:00.000Z' }],
  ['future', { start: '2026-10-08T00:00:00.000Z', end: '2026-10-15T00:00:00.000Z' }],
  ['different boss', { boss: 'Mutalius Cuboid' }]
]) {
  test(`${label} sheet data never appears as this week's routes`, async ({ page }) => {
    await prepare(page, { run: { ...currentRun, ...overrides } });
    await expect(page.locator('.weekly-battle-route')).toHaveCount(0);
    await expect(page.locator('.weekly-battle-requirements')).toHaveCount(0);
    await expect(page.locator('.weekly-battle-status')).toContainText(label === 'different boss' ? 'different boss' : 'not posted yet');
    await expect(page.locator('.weekly-battle-source')).toHaveAttribute('href', sourceUrl);
  });
}

test('a stale sheet response is checked again after a minute so posted routes appear promptly', async ({ page }) => {
  await prepare(page, { run: { ...currentRun, start: '2026-09-24T00:00:00.000Z', end: '2026-10-01T00:00:00.000Z' } });
  let retries = 0;
  await page.route('**/api/weekly-battle', route => {
    retries += 1;
    return route.fulfill({ json: { run: currentRun } });
  });
  await expect(page.locator('.weekly-battle-route')).toHaveCount(0);
  await page.clock.setFixedTime(new Date('2026-10-06T12:00:30Z'));
  await page.clock.runFor(1000);
  expect(retries).toBe(0);
  await page.clock.setFixedTime(new Date('2026-10-06T12:01:05Z'));
  await page.clock.runFor(1000);
  await expect.poll(() => retries).toBe(1);
  await expect(page.locator('.weekly-battle-route p > span')).toHaveText(currentRun.routes.flatMap(route => route.lines));
  await expect(page.locator('.weekly-battle-status')).toHaveCount(0);
});

test('the weekly reset hides expired routes and immediately checks the sheet again', async ({ page }) => {
  const requests = await prepare(page, { time: new Date('2026-10-07T23:59:59Z') });
  await expect(page.locator('.weekly-battle-route')).toHaveCount(2);
  await page.clock.setFixedTime(new Date('2026-10-08T00:00:01Z'));
  await page.clock.runFor(1000);
  await expect.poll(requests).toBe(2);
  await expect(page.locator('.weekly-battle-route')).toHaveCount(0);
  await expect(page.locator('.weekly-battle-status')).toContainText('not posted yet');
  await expect(page.locator('.rotation-weekly-battle .mini-list li')).toHaveCount(4);
});

test('desktop route scrolling and source focus survive refresh without frequent requests', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 640 });
  const requests = await prepare(page, { preferences: savedPreferences });
  const card = page.locator('.rotation-weekly-battle');
  const source = page.locator('.weekly-battle-source');
  await source.scrollIntoViewIfNeeded();
  await source.focus();
  await expect(source).toBeInViewport({ ratio: 1 });
  const scrollTop = await card.evaluate(element => element.scrollTop);
  expect(scrollTop).toBeGreaterThan(0);
  await page.clock.setFixedTime(new Date('2026-10-06T12:01:00Z'));
  await page.clock.runFor(1000);
  await expect(source).toBeFocused();
  expect(await card.evaluate(element => element.scrollTop)).toBeCloseTo(scrollTop, 0);
  expect(requests()).toBe(1);
  await page.clock.setFixedTime(new Date('2026-10-06T12:16:00Z'));
  await page.clock.runFor(1000);
  await expect.poll(requests).toBe(2);
  await expect(source).toBeFocused();
  expect(await card.evaluate(element => element.scrollTop)).toBeCloseTo(scrollTop, 0);
  expect(await page.evaluate(() => ({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight }))).toEqual({ width: 1200, height: 640 });
  await expectSavedPreferences(page);
});

for (const width of [320, 390]) {
  test(`weekly route lines and source remain reachable without clipping at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await prepare(page);
    const lines = page.locator('.weekly-battle-route p > span');
    await expect(lines).toHaveText(currentRun.routes.flatMap(route => route.lines));
    for (const line of await lines.all()) {
      await line.scrollIntoViewIfNeeded();
      await expect(line).toBeInViewport({ ratio: 1 });
      expect(await line.evaluate(element => element.scrollWidth <= element.clientWidth && element.scrollHeight <= element.clientHeight)).toBe(true);
    }
    const source = page.locator('.weekly-battle-source');
    await source.scrollIntoViewIfNeeded();
    await expect(source).toBeInViewport({ ratio: 1 });
    const overflowing = await page.locator('.weekly-battle-guide, .weekly-battle-route, .weekly-battle-requirements').evaluateAll(elements => elements.filter(element => element.scrollWidth > element.clientWidth + 1).map(element => element.className));
    expect(overflowing).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
