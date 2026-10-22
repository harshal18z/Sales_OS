import { createServer } from "node:http";
import { Readable } from "node:stream";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const localEnvFile = resolve(root, ".env.local");
const envFile = resolve(root, ".env");
try { process.loadEnvFile(localEnvFile); } catch { /* optional local-only configuration */ }
try { process.loadEnvFile(envFile); } catch { /* deployment environment may inject variables directly */ }

const production = process.env.NODE_ENV === "production";
let vite;
let dispatchRPC;
let dispatchAPI;
if (production) {
  ({ dispatchRPC, dispatchAPI } = await import("../dist/server/rpc-entry.js"));
} else {
  const { createServer: createViteServer } = await import("vite");
  vite = await createViteServer({ configFile: resolve(root, "vite.config.ts"), server: { middlewareMode: true }, appType: "spa" });
  ({ dispatchRPC, dispatchAPI } = await vite.ssrLoadModule("/src/server/rpc-entry.ts"));
}

const maxBodyBytes = 1024 * 1024;
const contentTypes = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json", ".xml": "application/xml", ".txt": "text/plain; charset=utf-8" };

function sendJson(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" });
  res.end(JSON.stringify(payload));
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBodyBytes) throw Object.assign(new Error("Request is too large."), { status: 413 });
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw Object.assign(new Error("Request body must be valid JSON."), { status: 400 }); }
}

async function handleRPC(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed." });
  if (!String(req.headers["content-type"] || "").toLowerCase().startsWith("application/json")) return sendJson(res, 415, { error: "Content-Type must be application/json." });
  const origin = req.headers.origin;
  if (origin) {
    try {
      if (new URL(origin).host !== req.headers.host) return sendJson(res, 403, { error: "Request origin is not allowed." });
    } catch { return sendJson(res, 403, { error: "Request origin is not allowed." }); }
  }
  const authorization = String(req.headers.authorization || "");
  if (!authorization.startsWith("Bearer ") || authorization.length > 4100) return sendJson(res, 401, { error: "Sign in to continue." });
  try {
    const body = await readJson(req);
    if (!body || typeof body.name !== "string" || body.name.length > 100 || !body.payload || typeof body.payload !== "object") return sendJson(res, 400, { error: "Invalid API request." });
    const data = await dispatchRPC(body.name, body.payload, authorization.slice(7));
    return sendJson(res, 200, { data });
  } catch (error) {
    const status = Number(error?.status) || (String(error?.message || "").includes("session is invalid") ? 401 : 400);
    if (status >= 500) console.error("SalesOS API error", error);
    const message = process.env.NODE_ENV === "production" && status >= 500 ? "The operation could not be completed." : (error instanceof Error ? error.message : "The operation could not be completed.");
    return sendJson(res, status, { error: message });
  }
}

async function handleAIEndpoint(req, res, path) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed." });
  if (!String(req.headers["content-type"] || "").toLowerCase().startsWith("application/json")) return sendJson(res, 415, { error: "Content-Type must be application/json." });
  const origin = req.headers.origin;
  if (origin) {
    try { if (new URL(origin).host !== req.headers.host) return sendJson(res, 403, { error: "Request origin is not allowed." }); }
    catch { return sendJson(res, 403, { error: "Request origin is not allowed." }); }
  }
  const authorization = String(req.headers.authorization || "");
  if (!authorization.startsWith("Bearer ") || authorization.length > 4100) return sendJson(res, 401, { error: "Sign in to continue." });
  try {
    const body = await readJson(req);
    const request = new Request(`http://${req.headers.host}${req.url}`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization },
      body: JSON.stringify(body),
    });
    const response = await dispatchAPI(path, request);
    if (!response) return sendJson(res, 404, { error: "API endpoint not found." });
    res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
    if (!response.body) return res.end();
    Readable.fromWeb(response.body).pipe(res);
  } catch (error) {
    const status = Number(error?.status) || 500;
    if (status >= 500) console.error("SalesOS AI API error", error);
    sendJson(res, status, { error: process.env.NODE_ENV === "production" ? "The operation could not be completed." : (error instanceof Error ? error.message : "Request failed.") });
  }
}

async function handleCron(req, res, path) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed." });
  const secret = process.env.CRON_SECRET;
  if (!secret) return sendJson(res, 503, { error: "Scheduled email worker is not configured." });
  if (String(req.headers.authorization || "") !== `Bearer ${secret}`) return sendJson(res, 401, { error: "Unauthorized." });
  try {
    const request = new Request(`http://${req.headers.host}${req.url}`, {
      method: "POST",
      headers: { authorization: `Bearer ${secret}` },
    });
    const response = await dispatchAPI(path, request);
    if (!response) return sendJson(res, 404, { error: "Worker endpoint not found." });
    res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
    if (!response.body) return res.end();
    Readable.fromWeb(response.body).pipe(res);
  } catch (error) {
    console.error("Scheduled email worker error", error);
    sendJson(res, 500, { error: "Scheduled emails could not be processed." });
  }
}

async function serveStatic(req, res) {
  const requestPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  const candidate = resolve(root, "dist", `.${requestPath}`);
  const distRoot = resolve(root, "dist") + sep;
  let file = candidate.startsWith(distRoot) ? candidate : resolve(root, "dist/index.html");
  try { if (!(await stat(file)).isFile()) file = resolve(root, "dist/index.html"); }
  catch { file = resolve(root, "dist/index.html"); }
  try {
    const body = await readFile(file);
    const type = contentTypes[extname(file)] || "application/octet-stream";
    const cache = file.endsWith("index.html") ? "no-cache" : "public, max-age=31536000, immutable";
    res.writeHead(200, { "content-type": type, "cache-control": cache, "x-content-type-options": "nosniff" });
    res.end(body);
  } catch { res.writeHead(404); res.end("Not found"); }
}

const server = createServer(async (req, res) => {
  const path = new URL(req.url, "http://localhost").pathname;
  if (path === "/api/rpc") return handleRPC(req, res);
  if (path === "/api/billing/mock-plan") return handleAIEndpoint(req, res, path);
  if (path === "/api/cron/scheduled-emails") return handleCron(req, res, path);
  if (path === "/api/ai/ask" || path === "/api/ai/copilot-plan") return handleAIEndpoint(req, res, path);
  if (production) return serveStatic(req, res);
  vite.middlewares(req, res, async () => {
    try {
      let template = await readFile(resolve(root, "index.html"), "utf-8");
      template = await vite.transformIndexHtml(req.url, template);
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(template);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  });
});

const port = Number(process.env.PORT || 8080);
server.listen(port, process.env.HOST || "0.0.0.0", () => console.log(`SalesOS server listening on ${port}`));
