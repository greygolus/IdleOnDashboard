const test = require("node:test");
const assert = require("node:assert/strict");
const profile = require("../profile-data");
test("source labels always follow the selected valid payload", () => {
  const manual = { data: { marker: "manual" } }, toolbox = { data: { marker: "toolbox" } };
  assert.equal(profile.resolve("manual", toolbox, manual).source, "manual");
  assert.equal(profile.resolve("manual", toolbox, "broken").source, "toolbox");
  assert.equal(profile.resolve(null, null, manual).source, "manual");
  assert.equal(profile.resolve(null, {}, []).source, "none");
});
test("successful requests cannot fabricate an upload date", () => {
  assert.equal(profile.normalize({ data: {} }, "a", "https://example.com", 123).lastUpdated, null);
  assert.equal(profile.normalize({ data: {} }, "a", "https://example.com", 123).fetchedAt, 123);
  assert.match(profile.describe(null), /unknown/i);
  assert.match(profile.describe(Date.parse("2026-05-20T23:15:08Z"), Date.parse("2026-09-05T12:00:00Z")), /days ago/);
});
test("legacy timestamp formats normalize without accepting impossible dates", () => {
  const expected = Date.parse("2026-05-20T23:15:08Z");
  assert.equal(profile.timestamp(expected / 1000), expected);
  assert.equal(profile.timestamp(String(expected)), expected);
  assert.equal(profile.timestamp("2026-05-20T23:15:08Z"), expected);
  for (const input of [null, "", "broken", -1, 1e30]) assert.equal(profile.timestamp(input), null);
});
test("errors and non-profile JSON never replace a cached profile", () => {
  for (const value of [{ error: "private" }, [], null, 1, "{}", { data: [] }]) assert.equal(profile.parse(value), null);
  assert.throws(() => profile.normalize({ error: "private" }, "a", "https://example.com"));
});
