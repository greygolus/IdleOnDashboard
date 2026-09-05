const test = require("node:test");
const assert = require("node:assert/strict");
const handler = require("../api/profiles");
function response() {
  return { code: 200, headers: {}, body: null,
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; }, send(body) { this.body = body; } };
}
test("proxy rejects unsupported requests before contacting the profile service", async () => {
  for (const [request, status] of [[{ method: "POST", query: {} }, 405], [{ method: "GET", query: {} }, 400], [{ method: "GET", query: { profile: "x".repeat(129) } }, 400]]) {
    const result = response(); await handler(request, result);
    assert.equal(result.code, status); assert.equal(result.headers["Cache-Control"], "no-store");
  }
});
test("proxy preserves upstream status and encoded public username", async (t) => {
  let requested;
  t.mock.method(globalThis, "fetch", async (url, options) => { requested = { url, options }; return new Response('{"error":"not found"}', { status: 404, headers: { "Content-Type": "application/json" } }); });
  const result = response(); await handler({ method: "GET", query: { profile: "Player + Name" } }, result);
  assert.equal(result.code, 404); assert.equal(result.body, '{"error":"not found"}');
  assert.equal(new URL(requested.url).searchParams.get("profile"), "Player + Name");
  assert.equal(new URL(requested.url).hostname, "profiles.idleontoolbox.workers.dev");
  assert.ok(requested.options.signal);
});
test("upstream timeout gives a retryable error without disclosing internal details", async (t) => {
  t.mock.method(globalThis, "fetch", async () => { throw new DOMException("internal details", "TimeoutError"); });
  const result = response(); await handler({ method: "GET", query: { profile: "Player" } }, result);
  assert.equal(result.code, 504); assert.match(result.body.error, /timed out/); assert.doesNotMatch(result.body.error, /internal/);
});
