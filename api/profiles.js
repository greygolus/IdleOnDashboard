const profileBase = "https://profiles.idleontoolbox.workers.dev/api";

module.exports = async function handler(request, response) {
  const username = String(request.query.profile || "").trim();

  if (!username) {
    response.status(400).json({ error: "Missing profile username." });
    return;
  }

  try {
    const target = `${profileBase}/profiles/?profile=${encodeURIComponent(username)}`;
    const profileResponse = await fetch(target, {
      headers: {
        "Accept": "application/json"
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
    response.status(502).json({ error: error.message || "Profile proxy failed." });
  }
};
