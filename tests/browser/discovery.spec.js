const { test, expect } = require('@playwright/test');
const P = 'idleon-dashboard-';
const personalUrl = 'https://example.com/my-sheet?x=1&y=2#my-tab';
const saved = [
  { id: 'personal', name: 'My sample sheet', url: 'https://example.com/original', personalUrl, type: 'sheet', preset: true, showInTools: true, inControls: true, favorite: true, note: 'Unique alchemy planning', extra: { keep: 1 } },
  { id: 'custom', name: 'Idleon Toolbox', url: 'https://example.com/custom', type: 'manual', showInTools: true, inControls: true, favorite: false },
  { id: 'hidden', name: 'Legacy hidden link', url: 'https://example.com/hidden', type: 'manual', showInTools: true, inControls: true },
  { id: 'library-only', name: 'Library favorite', url: 'https://example.com/library', type: 'manual', showInTools: false, inControls: false, favorite: true },
  { id: 'retired-hidden', name: 'Deliberately hidden preset', url: 'https://example.com/retired', type: 'sheet', preset: true, hiddenPreset: true, showInTools: true }
];
const layout = {
  tools: { collapsed: false, compact: false, hidden: ['ie-auto-review', 'saved-link-hidden'], order: ['idleon-wiki', 'saved-link-personal', 'future-resource', 'ie-auto-review', 'saved-link-custom', 'idleon-toolbox', 'research-optimizer', 'saved-link-hidden'], sizes: {}, extra: 'preserve' },
  sidebar: { order: ['saved', 'toolbox', 'links', 'controls', 'manual'], extra: 2 },
  future: { original: true }
};
async function prepare(page, overrides = {}) {
  await page.clock.install({ time: new Date('2026-09-05T12:00:00Z') });
  await page.addInitScript((values) => {
    if (!sessionStorage.getItem('discovery-seeded')) {
      Object.entries(values).forEach(([key, value]) => localStorage.setItem(key, value));
      sessionStorage.setItem('discovery-seeded', 'yes');
    }
  }, { [P+'onboarding-seen']: 'true', [P+'saved-links']: JSON.stringify(saved), [P+'layout']: JSON.stringify(layout), [P+'favorites']: '["idleon-wiki"]', [P+'notes']: 'My notes are unchanged', ...overrides });
  await page.route(/google\.com|idleon\.wiki|_vercel\/insights/, route => route.abort());
  await page.goto('/');
  await expect(page.locator('#toolGrid .tool-card').first()).toBeVisible();
}
const card = (page, id) => page.locator(`#toolGrid [data-card-id="${id}"]`);
const ids = page => page.locator('#toolGrid .tool-card').evaluateAll(cards => cards.map(card => card.dataset.cardId));
const raw = page => page.evaluate(P => Object.fromEntries(Object.entries(localStorage).filter(([key]) => key.startsWith(P) && !key.startsWith(P+'recovery-'))), P);

test('both densities expose the same complete chosen catalog and preserve layout data', async ({ page }) => {
  await prepare(page);
  const before = await raw(page), fullIds = await ids(page);
  expect(fullIds.length).toBe(10);
  expect(fullIds).toContain('idleon-guide-articles');
  expect(fullIds).toContain('saved-link-personal');
  expect(fullIds).not.toContain('saved-link-hidden');
  await page.getByRole('button', { name: 'Use compact tool cards', exact: true }).click();
  expect(await ids(page)).toEqual(fullIds);
  await expect(card(page,'saved-link-personal').getByRole('heading')).toBeVisible();
  await expect(card(page,'saved-link-personal').getByRole('button',{name:'Copy My sample sheet URL'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Use full tool cards',exact:true})).toBeFocused();
  const after = await raw(page);
  for (const [key,value] of Object.entries(before)) if (key !== P+'layout') expect(after[key]).toBe(value);
  const nextLayout = JSON.parse(after[P+'layout']);
  expect(nextLayout.tools).toEqual({ ...layout.tools, compact: true });
  expect(nextLayout.sidebar).toEqual(layout.sidebar); expect(nextLayout.future).toEqual(layout.future);
});

test('search, categories and library are read-only and preserve input focus', async ({ page }) => {
  await prepare(page);
  const before = await raw(page);
  const search = page.getByRole('searchbox',{name:'Find a tool or link'});
  await search.fill('  UNIQUE    alchemy ');
  expect(await ids(page)).toEqual(['saved-link-personal']);
  await expect(search).toBeFocused();
  await page.locator('#resourceCategory').selectOption('Review');
  await expect(page.getByText('No matching resources',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Clear filters',exact:true}).click();
  await expect(search).toBeFocused();
  await page.getByRole('button',{name:'All resources',exact:true}).click();
  await expect(card(page,'ie-auto-review')).toBeVisible();
  await expect(card(page,'saved-link-hidden')).toBeVisible();
  await expect(card(page,'saved-link-library-only')).toBeVisible();
  await expect(card(page,'saved-link-retired-hidden')).toHaveCount(0);
  await page.locator('#resourceCategory').selectOption('favorites');
  expect(await ids(page)).toEqual(['idleon-wiki','saved-link-personal','saved-link-library-only']);
  expect(await raw(page)).toEqual(before);
});

test('personal destinations, duplicate names and favorites retain their distinct identities', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read','clipboard-write']);
  await prepare(page);
  const sheet = card(page,'saved-link-personal');
  await expect(sheet.getByRole('link',{name:'My copy: My sample sheet'})).toHaveAttribute('href',personalUrl);
  await sheet.getByRole('button',{name:'Copy My sample sheet URL'}).click();
  expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe(personalUrl);
  await card(page,'saved-link-custom').getByRole('button',{name:'Add Idleon Toolbox to favorites',exact:true}).click();
  const current = await raw(page);
  expect(JSON.parse(current[P+'favorites'])).toEqual(['idleon-wiki']);
  expect(JSON.parse(current[P+'saved-links']).find(link=>link.id==='custom').favorite).toBe(true);
  expect(JSON.parse(current[P+'saved-links']).find(link=>link.id==='personal')).toMatchObject({personalUrl,extra:{keep:1}});
  await expect(card(page,'saved-link-custom').getByRole('button',{name:'Remove Idleon Toolbox from favorites',exact:true})).toBeFocused();
  await page.getByRole('button',{name:'Open Favorites',exact:true}).click();
  await expect(page.locator('#favoritesModalList')).toContainText('Library favorite');
});

test('explicit Show reconciles a legacy hidden card without altering other choices', async ({ page }) => {
  await prepare(page);
  await page.getByRole('button',{name:'All resources',exact:true}).click();
  await card(page,'saved-link-hidden').getByRole('button',{name:'Add Legacy hidden link to My tools'}).click();
  await page.getByRole('button',{name:'My tools',exact:true}).click();
  await expect(card(page,'saved-link-hidden')).toBeVisible();
  const current = await raw(page), nextLayout = JSON.parse(current[P+'layout']);
  expect(nextLayout.tools.hidden).toEqual(['ie-auto-review']);
  expect(nextLayout.tools.order).toEqual(layout.tools.order);
  const links = JSON.parse(current[P+'saved-links']);
  expect(links.find(link=>link.id==='retired-hidden').hiddenPreset).toBe(true);
  expect(links.find(link=>link.id==='library-only').showInTools).toBe(false);
  await card(page,'saved-link-personal').getByRole('button',{name:'Hide My sample sheet from My tools'}).click();
  const hidden = JSON.parse((await raw(page))[P+'saved-links']).find(link=>link.id==='personal');
  expect(hidden).toMatchObject({showInTools:false,personalUrl,favorite:true,extra:{keep:1}});
});

test('reordering while filtered preserves mixed, hidden and unknown order entries', async ({ page }) => {
  await prepare(page);
  await page.locator('#resourceSearch').fill('Corgan');
  const action = page.locator('#quickList').getByRole('button',{name:"Move Corgan's Optimizer earlier in Tools.",exact:true});
  await action.click();
  const current = JSON.parse((await raw(page))[P+'layout']);
  const prefix = [...layout.tools.order];
  [prefix[5],prefix[6]]=[prefix[6],prefix[5]];
  expect(current.tools.order.slice(0,prefix.length)).toEqual(prefix);
  expect(current.tools.hidden).toEqual(layout.tools.hidden);
  expect(current.future).toEqual(layout.future);
  await expect(action).toBeFocused();
  await page.reload();
  const order = await ids(page);
  expect(order.indexOf('research-optimizer')).toBeLessThan(order.indexOf('idleon-toolbox'));
  expect(order.indexOf('saved-link-personal')).toBeLessThan(order.indexOf('saved-link-custom'));
});

test('resource dialogs contain focus, close with Escape and return to the opener', async ({ page }) => {
  await prepare(page);
  for (const [button,id] of [['Manage saved links','savedLinksModal'],['Open Favorites','favoritesModal'],['Help','onboardingModal']]) {
    const opener=page.getByRole('button',{name:button,exact:true});
    await opener.click();
    const dialog=page.locator('#'+id);
    await expect(dialog).toBeVisible();
    expect(await dialog.evaluate(d=>d.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Shift+Tab');
    expect(await dialog.evaluate(d=>d.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible(); await expect(opener).toBeFocused();
  }
});

test('saved-link editing keeps field focus and restores a replaced opener safely', async ({ page }) => {
  await prepare(page);
  await page.locator('#savedLinks .saved-links-more').click();
  const input = page.locator('#savedLinksManagerList [data-saved-id="custom"] .saved-manager-name');
  await input.fill('Renamed custom tool');
  await input.evaluate(element => { element.setSelectionRange(2, 7); element.dispatchEvent(new Event('change', { bubbles: true })); });
  await expect(input).toBeFocused();
  expect(await input.evaluate(element => [element.selectionStart, element.selectionEnd])).toEqual([2, 7]);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button',{name:'Manage saved links',exact:true})).toBeFocused();
  expect(JSON.parse((await raw(page))[P+'saved-links']).find(link=>link.id==='custom').name).toBe('Renamed custom tool');
});

test('empty favorites agree between the filter and favorites dialog', async ({ page }) => {
  await prepare(page, { [P+'favorites']: '[]', [P+'saved-links']: JSON.stringify(saved.map(link=>({...link,favorite:false}))) });
  await page.locator('#resourceCategory').selectOption('favorites');
  await expect(page.locator('#toolGrid .tool-card')).toHaveCount(0);
  await page.getByRole('button',{name:'Open Favorites',exact:true}).click();
  await expect(page.locator('#favoritesModalList')).toContainText('No favorites yet');
  await expect(page.locator('#favoritesModalList button')).toHaveCount(0);
});

for (const [width,height] of [[320,740],[390,844],[768,700],[1920,1080],[960,540]]) {
  test(`resources, dialogs and later sections stay reachable at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({width,height});
    await prepare(page);
    const errors=[]; page.on('pageerror',e=>errors.push(e.message));
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.getByRole('button',{name:'Use compact tool cards',exact:true}).click();
    await expect(card(page,'saved-link-personal').getByRole('heading')).toBeVisible();
    await page.getByRole('button',{name:'Manage saved links',exact:true}).click();
    const bounds=await page.locator('#savedLinksModal').boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x+bounds.width).toBeLessThanOrEqual(width);
    expect(await page.locator('#savedLinksManagerList').evaluate(list => list.scrollWidth <= list.clientWidth)).toBe(true);
    if (width <= 390) {
      expect(await page.locator('.saved-manager-title').first().evaluate(title=>title.getBoundingClientRect().width)).toBeGreaterThan(180);
      await expect(page.locator('.saved-manager-actions').first().getByRole('button',{name:'Hide',exact:true})).toBeVisible();
    }
    await page.keyboard.press('Escape');
    await page.locator('#checklistInput').scrollIntoViewIfNeeded();
    await page.locator('#checklistInput').fill('A reachable task');
    await expect(page.locator('#checklistInput')).toBeInViewport();
    await page.locator('#notes').scrollIntoViewIfNeeded(); await page.locator('#notes').fill('Still reachable');
    await expect(page.locator('#notes')).toBeInViewport();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}
