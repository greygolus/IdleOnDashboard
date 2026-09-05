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
  request.query = { profile: url.searchParams.get("profile") };
  response.status = (code) => { response.statusCode = code; return response; };
  response.json = (value) => { response.setHeader("Content-Type", "application/json; charset=utf-8"); response.end(JSON.stringify(value)); };
  response.send = (body) => response.end(body);
  require("./api/profiles")(request, response).catch(() => {
    if (!response.writableEnded) send(response, 502, "Profile service unavailable");
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
  if (!filePath.startsWith(root + path.sep)) {
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

server.listen(port, "127.0.0.1", () => {
  console.log(`IdleOn Dashboard running at http://localhost:${port}/`);
});
