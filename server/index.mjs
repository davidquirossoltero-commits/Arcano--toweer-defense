import { createServer } from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createLimiter, emptyState, loadAccounts, rankRows, sanitizeState, verifyPassword } from "./security.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DAY = 24 * 60 * 60 * 1000;
const SESSION_MS = 7 * DAY;

function loadEnvFile() {
  const file = path.join(root, ".env");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function clientIp(req) {
  if (process.env.QUEST_TRUST_PROXY === "1") {
    const forwarded = req.headers["x-forwarded-for"];
    if (typeof forwarded === "string" && forwarded.length > 0) return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress ?? "unknown";
}

function readCookie(req, name) {
  const raw = req.headers.cookie ?? "";
  for (const part of raw.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return "";
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return false;
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  if (!host) return false;
  try {
    return new URL(origin).host === String(host);
  } catch {
    return false;
  }
}

function readBody(req, limit = 64_000) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("Cuerpo demasiado grande"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        const text = Buffer.concat(chunks).toString("utf8");
        resolve(text ? JSON.parse(text) : {});
      } catch {
        reject(new Error("JSON no válido"));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, payload, extraHeaders = {}) {
  const body = Buffer.from(JSON.stringify(payload));
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": body.length,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-store",
    ...extraHeaders,
  });
  res.end(body);
}

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
};

function serveFile(res, filePath) {
  try {
    const stat = statSync(filePath);
    if (!stat.isFile()) return false;
    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME_TYPES[ext] ?? "application/octet-stream";
    const cache = ext === ".html" ? "no-cache" : "public, max-age=31536000, immutable";
    res.writeHead(200, {
      "Content-Type": mime,
      "Content-Length": stat.size,
      "Cache-Control": cache,
      "X-Content-Type-Options": "nosniff",
    });
    res.end(readFileSync(filePath));
    return true;
  } catch {
    return false;
  }
}

async function main() {
  loadEnvFile();
  const accounts = await loadAccounts();
  const accountByUsername = new Map(accounts.map((acc) => [acc.username, acc]));
  const savesDir = path.join(root, "data", "saves");
  mkdirSync(savesDir, { recursive: true });

  const states = new Map();
  for (const account of accounts) {
    const file = path.join(savesDir, `${account.username}.json`);
    if (existsSync(file)) {
      try {
        states.set(account.username, sanitizeState(JSON.parse(readFileSync(file, "utf8"))));
      } catch {
        states.set(account.username, emptyState());
      }
    } else {
      states.set(account.username, emptyState());
    }
  }

  function saveStateOnDisk(username, state) {
    const target = path.join(savesDir, `${username}.json`);
    const temp = `${target}.${Date.now()}.tmp`;
    writeFileSync(temp, JSON.stringify(state, null, 2), "utf8");
    renameSync(temp, target);
  }

  const sessions = new Map();
  const limiter = createLimiter({ max: 5, windowMs: 15 * 60 * 1000 });

  function authFromProxy(req) {
    const secret = process.env.QUEST_PROXY_SECRET;
    if (!secret) return null;
    const givenSecret = req.headers["x-quest-secret"];
    if (typeof givenSecret !== "string") return null;
    try {
      const a = Buffer.from(secret);
      const b = Buffer.from(givenSecret);
      if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    } catch {
      return null;
    }
    const username = req.headers["x-quest-user"];
    if (typeof username !== "string") return null;
    return accountByUsername.get(username) ?? null;
  }

  function authUser(req) {
    const fromProxy = authFromProxy(req);
    if (fromProxy) return fromProxy;
    const token = readCookie(req, "arcano_session");
    if (!token) return null;
    const session = sessions.get(token);
    if (!session) return null;
    if (Date.now() > session.expiresAt) {
      sessions.delete(token);
      return null;
    }
    return accountByUsername.get(session.username) ?? null;
  }

  function createSession(username) {
    const token = randomBytes(32).toString("hex");
    sessions.set(token, { username, expiresAt: Date.now() + SESSION_MS });
    return token;
  }

  function cookieHeader(token, maxAgeSeconds) {
    const parts = [
      `arcano_session=${encodeURIComponent(token)}`,
      `Path=/`,
      `HttpOnly`,
      `SameSite=Lax`,
      `Max-Age=${maxAgeSeconds}`,
    ];
    if (process.env.QUEST_SECURE === "1") parts.push("Secure");
    return parts.join("; ");
  }

  const distDir = path.join(root, "dist");
  const port = Number(process.env.PORT) || 8095;
  const host = process.env.HOST || "0.0.0.0";

  const server = createServer(async (req, res) => {
    const ip = clientIp(req);
    const parsedUrl = new URL(req.url ?? "/", "http://localhost");
    const pathname = parsedUrl.pathname.replace(/^\/arcano-tower-defense/, "") || "/";

    if (pathname === "/api/me" && req.method === "GET") {
      const user = authUser(req);
      if (!user) return sendJson(res, 401, { error: "No autenticado" });
      return sendJson(res, 200, { username: user.username, name: user.name });
    }

    if (pathname === "/api/login" && req.method === "POST") {
      const limit = limiter.check(`ip:${ip}`);
      if (!limit.ok) {
        return sendJson(res, 429, { error: `Demasiados intentos. Espera ${limit.retryAfter} s.` });
      }
      let body;
      try {
        body = await readBody(req);
      } catch (err) {
        return sendJson(res, 400, { error: err.message });
      }
      const username = String(body.username ?? "").trim();
      const password = String(body.password ?? "");
      const account = accountByUsername.get(username);
      if (!account || !(await verifyPassword(password, account.passwordHash))) {
        return sendJson(res, 401, { error: "Usuario o contraseña incorrectos." });
      }
      limiter.reset(`ip:${ip}`);
      const token = createSession(account.username);
      return sendJson(res, 200, { ok: true, username: account.username, name: account.name }, {
        "Set-Cookie": cookieHeader(token, Math.floor(SESSION_MS / 1000)),
      });
    }

    if (pathname === "/api/logout" && (req.method === "POST" || req.method === "GET")) {
      const token = readCookie(req, "arcano_session");
      if (token) sessions.delete(token);
      return sendJson(res, 200, { ok: true }, {
        "Set-Cookie": cookieHeader("", 0),
      });
    }

    if (pathname === "/api/progress" && req.method === "GET") {
      const user = authUser(req);
      if (!user) return sendJson(res, 401, { error: "No autenticado" });
      const state = states.get(user.username) ?? emptyState();
      return sendJson(res, 200, { state });
    }

    if (pathname === "/api/progress" && req.method === "PUT") {
      const user = authUser(req);
      if (!user) return sendJson(res, 401, { error: "No autenticado" });
      let body;
      try {
        body = await readBody(req);
      } catch (err) {
        return sendJson(res, 400, { error: err.message });
      }
      const state = sanitizeState(body.state);
      states.set(user.username, state);
      saveStateOnDisk(user.username, state);
      return sendJson(res, 200, { ok: true, state });
    }

    if (pathname === "/api/ranking" && req.method === "GET") {
      const user = authUser(req);
      const rows = rankRows(accounts, states);
      return sendJson(res, 200, { rows, me: user ? user.username : null });
    }

    // Static assets
    if (req.method === "GET" || req.method === "HEAD") {
      const clean = pathname.replace(/^\/+/, "");
      const full = path.join(distDir, clean);
      if (full.startsWith(distDir) && existsSync(full) && statSync(full).isFile()) {
        if (serveFile(res, full)) return;
      }
      const indexHtml = path.join(distDir, "index.html");
      if (existsSync(indexHtml)) {
        if (serveFile(res, indexHtml)) return;
      }
    }

    sendJson(res, 404, { error: "No encontrado" });
  });

  server.listen(port, host, () => {
    console.log(`Arcano: Tower Defense escuchando en http://${host}:${port}`);
  });
}

main().catch((err) => {
  console.error("Fallo al arrancar Arcano:", err);
  process.exit(1);
});
