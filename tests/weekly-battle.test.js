const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const handler = require("../api/weekly-battle");
const parse = handler.parseWeeklyBattleCsv;
// Transcribed from the source Raw Data tab's 1 Oct and 8 Oct 2026 columns.
const fixture = fs.readFileSync(path.join(__dirname, "fixtures", "weekly-battle.csv"), "utf8");
const currentTime = "2026-10-06T19:00:00.000Z";

function response() {
  return {
    code: 200, headers: {}, body: null,
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; }
  };
}

function fixtureForToday() {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - 3);
  const replacements = {};
  for (const original of ["01 Oct 26", "08 Oct 26", "15 Oct 26"]) {
    replacements[original] = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "2-digit", timeZone: "UTC" }).format(date);
    date.setUTCDate(date.getUTCDate() + 7);
  }
  return fixture.replace(/01 Oct 26|08 Oct 26|15 Oct 26/g, value => replacements[value]);
}

test("weekly sheet current run matches the published summary, including commas, FR, Skip, trophies and bonuses", () => {
  assert.deepEqual(parse(fixture, currentTime), {
    start: "2026-10-01T00:00:00.000Z", end: "2026-10-08T00:00:00.000Z", boss: "Mollo Gomm",
    requirements: [
      { name: "Material Carry Cap", characters: "1, 3, 5, 8, 9, 10" },
      { name: "Mining lvl", characters: "2, 7" },
      { name: "Class lvl", characters: "4, 6, 11" }
    ],
    routes: [
      { name: "5 Skulls", lines: ["1 2 2 - 1 1 (FR)", "1 2 1 - 1 3 Skip - 2 3 1 - 3 3 3 - 3"] },
      { name: "Misc + Trophy", lines: ["3 1 2 - 2 1 (FR)", "3 1 2 - 2 3 Skip - 3 1 3 - 3 3"] }
    ],
    trophies: 3, bonuses: [{ name: "Class EXP", value: "30%" }, { name: "Damage", value: "15%" }]
  });
});

test("weekly selection changes exactly at 00:00 UTC and handles longer routes with shifted bonus rows", () => {
  assert.equal(parse(fixture, "2026-10-07T23:59:59.999Z").boss, "Mollo Gomm");
  const next = parse(fixture, "2026-10-08T00:00:00.000Z");
  assert.equal(next.boss, "Eclectic Lazlo");
  assert.equal(next.requirements[0].name, "Chopping lvl");
  assert.equal(next.routes[0].lines.length, 6);
  assert.equal(next.trophies, 4);
  assert.deepEqual(next.bonuses, [{ name: "Class EXP", value: "45%" }, { name: "Damage", value: "0%" }]);
});

test("an exhausted schedule returns actual past dates and never labels an upcoming run current", () => {
  const past = parse(fixture, "2026-10-16T00:00:00Z");
  assert.equal(past.boss, "Eclectic Lazlo");
  assert.equal(past.end, "2026-10-15T00:00:00.000Z");
  assert.throws(() => parse(fixture, "2026-09-30T23:59:59Z"), /unsupported format/);
});

test("CSV parser accepts BOM, CRLF, multiline labels and escaped quotes while preserving route caveats", () => {
  const withNote = fixture.replace(",,2 3 1 - 1 1 3 - 1 3 (FR)", ',"Most likely 4 skulls, unless ""endgame""",2 3 1 - 1 1 3 - 1 3 (FR)');
  const run = parse(`\uFEFF${withNote.replace(/\n/g, "\r\n")}`, currentTime);
  assert.equal(run.routes[0].lines[2], 'Most likely 4 skulls, unless "endgame"');
});

test("malformed or changed sheet data fails validation instead of supplying misleading directions", () => {
  const malformed = [
    fixture.replace(/01 Oct 26/g, "31 Sep 26"),
    fixture.replace("Boss Name", "Other values"),
    fixture.replace("# of Trophies,3", "# of Trophies,lots"),
    fixture.replace("1 2 2 - 1 1 (FR)", "Directions unavailable").replace("1 2 1 - 1 3 Skip - 2 3 1 - 3 3 3 - 3", ""),
    fixture.replace("Bonus Class EXP : 30%", "Bonus Class EXP : unknown"),
    fixture.replace('"Material Carry Cap - 1, 3, 5, 8, 9, 10"', '"Material Carry Cap - unknown"'),
    fixture.replace('"Character\nRequirements"', '"Character\nRequirements'),
    "<html>Sign in to Google</html>"
  ];
  for (const csv of malformed) assert.throws(() => parse(csv, currentTime), /unsupported format/);
});

test("weekly endpoint rejects non-GET requests without contacting Google", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () => { throw new Error("Unexpected fetch"); });
  const result = response();
  await handler({ method: "POST" }, result);
  assert.equal(result.code, 405);
  assert.equal(result.headers.Allow, "GET");
  assert.equal(result.headers["Cache-Control"], "no-store");
  assert.equal(fetch.mock.callCount(), 0);
});

test("weekly endpoint uses only the fixed public source, omits credentials and permits five-minute CDN caching", async (t) => {
  let requested;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    requested = { url: new URL(url), options };
    return new Response(fixtureForToday(), { headers: { "Content-Type": "text/csv" } });
  });
  const result = response();
  await handler({ method: "GET", query: { url: "https://untrusted.example/", profile: "private-name" } }, result);
  assert.equal(result.code, 200);
  assert.equal(result.body.run.boss, "Mollo Gomm");
  assert.ok(Number.isFinite(Date.parse(result.body.fetchedAt)));
  assert.match(result.body.sourceUrl, /htmlview\?gid=0$/);
  assert.equal(result.headers["Cache-Control"], "public, max-age=0, s-maxage=300");
  assert.equal(requested.url.hostname, "docs.google.com");
  assert.equal(requested.url.searchParams.get("gid"), "787764386");
  assert.equal(requested.url.searchParams.get("range"), "A1:ZZ60");
  assert.equal(requested.options.credentials, "omit");
  assert.ok(requested.options.signal);
  assert.doesNotMatch(requested.url.href, /private-name|untrusted/);
});

test("unavailable, HTML and oversized source responses return uncached 502 errors", async (t) => {
  for (const upstream of [
    new Response("access denied", { status: 403 }),
    new Response("<html>Google sign-in</html>"),
    new Response("x".repeat(256 * 1024 + 1))
  ]) {
    const mocked = t.mock.method(globalThis, "fetch", async () => upstream);
    const result = response();
    await handler({ method: "GET" }, result);
    assert.equal(result.code, 502);
    assert.equal(result.headers["Cache-Control"], "no-store");
    assert.equal(result.body.run, undefined);
    mocked.mock.restore();
  }
});

test("CDN cache expires at weekly reset instead of retaining the previous run", async (t) => {
  t.mock.method(Date, "now", () => Date.parse("2026-10-07T23:59:30.000Z"));
  t.mock.method(globalThis, "fetch", async () => new Response(fixture));
  const result = response();
  await handler({ method: "GET" }, result);
  assert.equal(result.code, 200);
  assert.equal(result.body.fetchedAt, "2026-10-07T23:59:30.000Z");
  assert.equal(result.body.run.end, "2026-10-08T00:00:00.000Z");
  assert.equal(result.headers["Cache-Control"], "public, max-age=0, s-maxage=30");
});

test("expired source runs retain their dates but get no CDN cache lifetime", async (t) => {
  t.mock.method(Date, "now", () => Date.parse("2026-10-16T00:00:00.000Z"));
  t.mock.method(globalThis, "fetch", async () => new Response(fixture));
  const result = response();
  await handler({ method: "GET" }, result);
  assert.equal(result.code, 200);
  assert.equal(result.body.run.end, "2026-10-15T00:00:00.000Z");
  assert.equal(result.headers["Cache-Control"], "public, max-age=0, s-maxage=0");
});

test("upstream timeout returns an uncached 504 without disclosing source errors", async (t) => {
  t.mock.method(globalThis, "fetch", async () => { throw new DOMException("internal transport detail", "TimeoutError"); });
  const result = response();
  await handler({ method: "GET" }, result);
  assert.equal(result.code, 504);
  assert.equal(result.headers["Cache-Control"], "no-store");
  assert.match(result.body.error, /timed out/);
  assert.doesNotMatch(result.body.error, /internal/);
});
