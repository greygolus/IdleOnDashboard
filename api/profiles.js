const profileBase = "https://profiles.idleontoolbox.workers.dev/api";

module.exports = async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    response.status(405).json({ error: "Use GET to check a public profile." });
    return;
  }
  const username = String(request.query.profile || "").trim();

  if (!username) {
    response.status(400).json({ error: "Missing profile username." });
    return;
  }
  if (username.length > 128) {
    response.status(400).json({ error: "Profile username is too long." });
    return;
  }

  try {
    const target = `${profileBase}/profiles/?profile=${encodeURIComponent(username)}&_=${Date.now()}`;
    const profileResponse = await fetch(target, {
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
      headers: {
        "Accept": "application/json",
        "Cache-Control": "no-cache"
      }
    });
    const upstreamContentType = profileResponse.headers.get("content-type") || "";
    const contentType = upstreamContentType.includes("application/json")
      ? "application/json; charset=utf-8"
      : "text/plain; charset=utf-8";
    const body = await profileResponse.text();

    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Content-Type", contentType);
    response.status(profileResponse.status).send(body);
  } catch (error) {
    const timedOut = error.name === "TimeoutError" || error.name === "AbortError";
    response.status(timedOut ? 504 : 502).json({ error: timedOut ? "The profile service timed out. Please try again." : "The profile service is unavailable. Please try again." });
  }
};
