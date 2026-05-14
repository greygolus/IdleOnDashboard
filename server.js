const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const port = Number(process.env.PORT || 4173);
const profileBase = "https://profiles.idleontoolbox.workers.dev/api";
const wikiBase = "https://idleon.wiki";

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

function send(response, status, body, headers = {}) {
  response.writeHead(status, {
    "Cache-Control": "no-store",
    ...headers
  });
  response.end(body);
}

function proxyProfile(request, response, url) {
  const username = url.searchParams.get("profile") || "";
  if (!username.trim()) {
    send(response, 400, JSON.stringify({ error: "Missing profile username." }), {
      "Content-Type": "application/json; charset=utf-8"
    });
    return;
  }

  const target = `${profileBase}/profiles/?profile=${encodeURIComponent(username.trim())}&_=${Date.now()}`;
  https.get(target, {
    headers: {
      "Accept": "application/json",
      "Cache-Control": "no-cache"
    }
  }, (profileResponse) => {
    let body = "";
    profileResponse.setEncoding("utf8");
    profileResponse.on("data", (chunk) => {
      body += chunk;
    });
    profileResponse.on("end", () => {
      send(response, profileResponse.statusCode || 502, body, {
        "Content-Type": profileResponse.headers["content-type"] || "application/json; charset=utf-8"
      });
    });
  }).on("error", (error) => {
    send(response, 502, JSON.stringify({ error: error.message }), {
      "Content-Type": "application/json; charset=utf-8"
    });
  });
}

function proxyWiki(request, response, url) {
  const target = `${wikiBase}${url.pathname}${url.search}`;
  https.get(target, (wikiResponse) => {
    const status = wikiResponse.statusCode || 502;
    const location = wikiResponse.headers.location;

    if (status >= 300 && status < 400 && location) {
      const redirectUrl = new URL(location, wikiBase);
      send(response, 302, "", {
        "Location": `${redirectUrl.pathname}${redirectUrl.search}`
      });
      return;
    }

    response.writeHead(status, {
      "Cache-Control": "public, max-age=86400",
      "Content-Type": wikiResponse.headers["content-type"] || "application/octet-stream"
    });
    wikiResponse.pipe(response);
  }).on("error", (error) => {
    send(response, 502, error.message, {
      "Content-Type": "text/plain; charset=utf-8"
    });
  });
}

function serveStatic(request, response, url) {
  const pathname = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const filePath = path.resolve(root, `.${pathname}`);
  if (!filePath.startsWith(root)) {
    send(response, 403, "Forbidden", { "Content-Type": "text/plain; charset=utf-8" });
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      send(response, 404, "Not found", { "Content-Type": "text/plain; charset=utf-8" });
      return;
    }
    send(response, 200, content, {
      "Content-Type": contentTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream"
    });
  });
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  if (url.pathname === "/api/profiles") {
    proxyProfile(request, response, url);
    return;
  }
  if (["/images", "/resources", "/wiki"].some((prefix) => url.pathname.startsWith(prefix))) {
    proxyWiki(request, response, url);
    return;
  }
  serveStatic(request, response, url);
});

server.listen(port, () => {
  console.log(`IdleOn Dashboard running at http://localhost:${port}/`);
});
