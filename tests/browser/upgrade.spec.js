const { test, expect } = require("@playwright/test");
const { readFileSync } = require("node:fs");
const { execFileSync } = require("node:child_process");
const P = "idleon-dashboard-";
const now = new Date("2026-09-05T12:00:00Z");
const manual = { data: { TimeAway: JSON.stringify({ GlobalTime: now.getTime() / 1000 }) }, serverVars: { RandEvntHr: 1, HappyHours: [360000] }, lastUpdated: Date.parse("2026-05-20T23:15:08Z") };
const links = [
  { id: "preset-sampling-skilling-checklist", name: "Sampling and Skilling Checklist", personalUrl: "https://example.com/my-sheet?x=1#tab", preset: true, type: "sheet", showInSavedPanel: true, favorite: true, customMetadata: { keep: 1 } },
  { id: "mine", name: "Sampling and Skilling Checklist", url: "https://example.com/personal", type: "manual", favorite: true, inControls: true, showInTools: true, showInSavedPanel: true, customMetadata: "keep me" },
  { id: "preset-idleon-guide", name: "Retired personal resource", url: "https://example.com/old", personalUrl: "https://example.com/my-old", preset: true, type: "doc", favorite: true, inControls: true },
  { id: "html-name", name: '<img src=x onerror="window.__injected=true">', url: "https://example.com/safe", type: "manual", inControls: true, favorite: true, showInTools: true }
];
function fixture() {
  return {
    [P + "notes"]: "My notes\n  exact spacing and ★ Unicode",
    [P + "favorites"]: '["idleon-toolbox","idleon-wiki"]',
    [P + "toolbox-username"]: "LegacyPlayer",
    [P + "account-link"]: "https://idleontoolbox.com/?profile=LegacyPlayer",
    [P + "toolbox-payload"]: JSON.stringify({ ...manual, username: "LegacyPlayer" }),
    [P + "manual-json"]: JSON.stringify(manual),
    [P + "intel-source"]: "manual",
    [P + "saved-links"]: JSON.stringify(links),
    [P + "checklist-items"]: JSON.stringify([{ id: "goal", text: "Keep <b>my goal</b>", type: "current", done: true, extra: 3 }, { id: "daily", text: "My daily", type: "daily", done: false }]),
    [P + "checklist-state"]: JSON.stringify({ dailyKey: "daily-2026-09-05-00:00", weeklyKey: "weekly-2957", dailyChecked: { daily: true }, weeklyChecked: {}, extra: "preserve" }),
    [P + "checklist-settings"]: '{"idleonResetTime":"00:00","extra":"keep"}',
    [P + "layout"]: JSON.stringify({ tools: { compact: true, order: ["idleon-wiki", "saved-link-mine", "idleon-toolbox"], hidden: ["saved-link-html-name"], sizes: {} }, sidebar: { order: ["saved", "toolbox", "links", "controls", "manual"] }, future: { keep: true } }),
    [P + "onboarding-seen"]: "true"
  };
}
async function prepare(page, values = fixture()) {
  await page.clock.install({ time: now });
  await page.addInitScript((values) => {
    if (!sessionStorage.getItem("test-seeded")) {
      Object.entries(values).forEach(([key, value]) => localStorage.setItem(key, value));
      sessionStorage.setItem("test-seeded", "yes");
    }
  }, values);
  await page.route(/google\.com|idleon\.wiki|_vercel\/insights/, (route) => route.abort());
  await page.goto("/");
  await expect(page.locator("#toolGrid .tool-card").first()).toBeVisible();
}
async function rawState(page) { return page.evaluate((P) => Object.fromEntries(Object.entries(localStorage).filter(([key]) => key.startsWith(P) && !key.startsWith(P + "recovery-"))), P); }
async function downloadBackup(page, button) {
  await page.getByRole("button", { name: "Backups", exact: true }).click();
  if (button.includes("before-")) await page.getByText("Recovery copies", { exact: true }).click();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: button, exact: true }).click();
  const download = await downloaded;
  return JSON.parse(readFileSync(await download.path(), "utf8"));
}

test("a populated old dashboard upgrades without changing its raw saved data", async ({ page }) => {
  const legacy = execFileSync("git", ["show", "27a2656:app.js"], { encoding: "utf8" });
  await page.route("**/app.js", (route) => route.fulfill({ body: legacy, contentType: "text/javascript" }));
  await prepare(page);
  const before = await rawState(page);
  await page.unroute("**/app.js");
  await page.reload();
  await expect(page.locator("#intelSourceStatus")).toContainText("Manual JSON");
  expect(await rawState(page)).toEqual(before);
  const backup = await downloadBackup(page, "Download before-update copy");
  for (const [key, value] of Object.entries(before)) expect(backup.values[key]).toBe(value);
});

test("personal copies, name collisions, retired links and unknown fields survive edits", async ({ page }) => {
  await prepare(page);
  await page.locator("#manageSavedLinks").click();
  const manager = page.locator("#savedLinksManagerList");
  await expect(manager.getByText("Retired personal resource", { exact: true })).toBeVisible();
  const custom = manager.locator(".saved-manager-item").filter({ has: page.locator('input[value="https://example.com/personal"]') });
  await custom.locator(".saved-manager-name").fill("My renamed link");
  await custom.locator(".saved-manager-name").press("Tab");
  const stored = JSON.parse((await rawState(page))[P + "saved-links"]);
  expect(stored.find((link) => link.id === "mine")).toMatchObject({ name: "My renamed link", customMetadata: "keep me" });
  expect(stored.find((link) => link.id === "preset-sampling-skilling-checklist").personalUrl).toBe("https://example.com/my-sheet?x=1#tab");
  expect(stored.find((link) => link.id === "preset-idleon-guide").personalUrl).toBe("https://example.com/my-old");
  expect(stored.find((link) => link.id === "preset-idleon-guide").type).toBe("doc");
});

test("hiding and restoring a sheet retains its personal copy and favorites", async ({ page }) => {
  await prepare(page);
  await page.locator("#manageSavedLinks").click();
  const row = page.locator(".saved-manager-item.is-preset-resource").filter({ hasText: "Sampling and Skilling Checklist" }).first();
  await row.getByRole("button", { name: "Hide", exact: true }).click();
  await row.getByRole("button", { name: "Confirm", exact: true }).click();
  let record = JSON.parse((await rawState(page))[P + "saved-links"]).find((link) => link.id === "preset-sampling-skilling-checklist");
  expect(record.personalUrl).toBe(links[0].personalUrl);
  expect(record.favorite).toBe(true);
  await row.getByRole("button", { name: "Restore", exact: true }).click();
  record = JSON.parse((await rawState(page))[P + "saved-links"]).find((link) => link.id === "preset-sampling-skilling-checklist");
  expect(record.personalUrl).toBe(links[0].personalUrl);
  expect(record.hiddenPreset).toBe(false);
});

test("corrupted records do not prevent startup or overwrite original data", async ({ page }) => {
  const values = fixture(); values[P + "favorites"] = "{broken"; values[P + "saved-links"] = JSON.stringify([null, ...links]);
  await prepare(page, values);
  await expect(page.locator("#storageWarning")).toBeVisible();
  await expect(page.locator("#notes")).toHaveValue(values[P + "notes"]);
  expect((await rawState(page))[P + "favorites"]).toBe("{broken");
  expect((await rawState(page))[P + "saved-links"]).toBe(values[P + "saved-links"]);
});

test("saved HTML-like names and tasks render literally", async ({ page }) => {
  await prepare(page);
  await page.locator("#openFavorites").click();
  await expect(page.locator("#favoritesModalList")).toContainText(links[3].name);
  expect(await page.evaluate(() => window.__injected)).toBeUndefined();
  await expect(page.locator("#checklistList")).toContainText("Keep <b>my goal</b>");
  expect(await page.locator("#checklistList b").count()).toBe(0);
});

test("backup download and restore works through the UI and preserves omitted profile data", async ({ page }) => {
  await prepare(page);
  const backup = await downloadBackup(page, "Download current backup");
  delete backup.values[P + "manual-json"];
  backup.values[P + "notes"] = "Restored notes";
  await page.locator("#backupFile").setInputFiles({ name: "backup.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(backup)) });
  await expect(page.locator("#restorePreview")).toContainText("saved sections will be replaced");
  await page.locator("#restoreBackup").click();
  await expect(page.locator("#notes")).toHaveValue("Restored notes");
  expect((await rawState(page))[P + "manual-json"]).toBe(fixture()[P + "manual-json"]);
});

test("profile request failure and switching to manual data preserve the old cache", async ({ page }) => {
  await prepare(page);
  const before = (await rawState(page))[P + "toolbox-payload"];
  await page.route("**/api/profiles?*", async (route) => { await new Promise((resolve) => setTimeout(resolve, 400)); await route.fulfill({ status: 200, json: { data: { new: true } } }).catch(() => {}); });
  await page.locator("#fetchProfileData").click();
  await page.locator("#useManualJsonForIntel").click();
  await expect(page.locator("#syncStatus")).not.toHaveText("Checked");
  expect((await rawState(page))[P + "toolbox-payload"]).toBe(before);
  await page.unroute("**/api/profiles?*");
  await page.route("**/api/profiles?*", (route) => route.fulfill({ status: 200, json: { error: "private" } }));
  await page.locator("#fetchProfileData").click();
  await expect(page.locator("#syncStatus")).toHaveText("Check failed");
  expect((await rawState(page))[P + "toolbox-payload"]).toBe(before);
});

test("weekly and tournament resets update without a wiki response", async ({ page }) => {
  await prepare(page);
  await page.clock.setFixedTime(new Date("2026-09-09T23:59:59Z"));
  await page.clock.runFor(1000);
  const before = await page.locator(".rotation-lab-rotation h3").textContent();
  await page.clock.setFixedTime(new Date("2026-09-10T00:00:01Z"));
  await page.clock.runFor(1000);
  await expect(page.locator(".rotation-lab-rotation h3")).not.toHaveText(before);
  await page.clock.setFixedTime(new Date("2026-09-10T20:00:01Z"));
  await page.clock.runFor(1000);
  await expect(page.locator(".daily-tournament-countdown")).toContainText("23h");
});

test("calculator focus and selection survive the minute refresh", async ({ page }) => {
  await prepare(page);
  await page.locator("#rateValue").fill("12345");
  await page.locator("#rateValue").evaluate((input) => input.setSelectionRange(1, 3));
  await page.clock.setFixedTime(new Date("2026-09-05T12:01:00Z"));
  await page.clock.runFor(1000);
  await expect(page.locator("#rateValue")).toBeFocused();
  await expect(page.locator("#rateValue")).toHaveValue("12345");
  expect(await page.locator("#rateValue").evaluate((input) => [input.selectionStart, input.selectionEnd])).toEqual([1, 3]);
});

test("legacy session profile remains in the recovery backup even with a different local profile", async ({ page }) => {
  const raw = JSON.stringify({ data: { sessionOnly: true }, username: "SessionPlayer" });
  await page.addInitScript(({ key, raw }) => sessionStorage.setItem(key, raw), { key: P + "toolbox-payload", raw });
  await prepare(page);
  const backup = await downloadBackup(page, "Download before-update copy");
  expect(backup.sessionValues[P + "toolbox-payload"]).toBe(raw);
  expect(backup.values[P + "toolbox-payload"]).toBe(fixture()[P + "toolbox-payload"]);
});

test("malformed nested data and duplicate identities stay intact after edits", async ({ page }) => {
  const values = fixture();
  values[P + "saved-links"] = JSON.stringify([links[0], { ...links[0], personalUrl: "https://example.com/second-copy" }, { ...links[1], note: { keep: "raw" } }]);
  values[P + "checklist-state"] = '{"dailyChecked":["daily"],"weeklyChecked":{}}';
  values[P + "layout"] = '{"tools":{"hidden":{},"order":[]}}';
  await prepare(page, values);
  await expect(page.locator("#storageWarning")).toBeVisible();
  await page.locator("#savedLinkName").fill("Another link");
  await page.locator("#savedLinkUrl").fill("https://example.com/new");
  await page.locator("#savedLinkForm button[type=submit]").click();
  const after = await rawState(page);
  for (const key of ["saved-links", "checklist-state", "layout"]) expect(after[P + key]).toBe(values[P + key]);
});

test("recovery UI works at phone width with keyboard dismissal", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await prepare(page);
  await page.getByRole("button", { name: "Backups", exact: true }).click();
  await expect(page.locator("#backupDialog")).toBeVisible();
  expect(await page.locator("#backupDialog").evaluate((dialog) => dialog.scrollWidth <= dialog.clientWidth)).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.locator("#backupDialog")).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Backups", exact: true })).toBeFocused();
});
