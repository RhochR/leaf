// Leaf-Server: zwei API-Endpunkte + statisches Ausliefern der Editor-Seite (web/).
// Bewusst ohne externe Abhängigkeiten — nur eingebaute Node-Module. Start:
//   LEAF_PASSPHRASE=eure-gemeinsame-passphrase node server/server.js
// Port per Umgebungsvariable: PORT=8080 node server/server.js (Default 8080).
//
// Genau EIN Status-Paar (Slot a + b), keine "Räume" — dieser Server ist für genau ein
// Paar gedacht. Die Passphrase kommt als Umgebungsvariable von außen (vom Hoster beim
// Deploy gesetzt), nicht "wer zuerst schreibt, legt sie fest" wie in einer früheren
// Version — das hätte es Fremden erlaubt, sich einfach selbst zu bedienen.

import { createServer } from "node:http";
import { createHash, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Store } from "./store.js";

const PORT = Number(process.env.PORT) || 8080;
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const WEB_DIR = resolve(ROOT, "web");
const DATA_FILE = resolve(ROOT, "server", "data", "db.json");
const MAX_BODY_BYTES = 2048;
const MAX_FIELD_LEN = 300;

const PASSPHRASE = process.env.LEAF_PASSPHRASE;
if (!PASSPHRASE) {
  console.error(
    "LEAF_PASSPHRASE ist nicht gesetzt. Server startet nicht ohne eure gemeinsame " +
      "Passphrase — siehe README.md.",
  );
  process.exit(1);
}
// Dieselbe Herleitung wie im Client (web/app.js, android SessionStore.kt): sha256(passphrase).
const EXPECTED_TOKEN_HASH = hashToken(
  createHash("sha256").update(PASSPHRASE, "utf8").digest("hex"),
);

const store = new Store(DATA_FILE);

// --- Grobes Rate-Limiting: ein paar Schreibzugriffe pro Minute reichen für zwei
// Menschen völlig; alles darüber ist eher ein Bug als eine legitime Nutzung.
const WRITE_LIMIT = 8;
const WRITE_WINDOW_MS = 60_000;
let writeLog = [];

function isRateLimited() {
  const now = Date.now();
  writeLog = writeLog.filter((t) => now - t < WRITE_WINDOW_MS);
  writeLog.push(now);
  return writeLog.length > WRITE_LIMIT;
}

// --- Kleine Helfer für Antworten -------------------------------------------------

function sendJson(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(json),
    "Access-Control-Allow-Origin": "*",
  });
  res.end(json);
}

function sendError(res, status, message) {
  sendJson(res, status, { error: message });
}

const STATIC_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
};

async function serveStatic(req, res, pathname) {
  const safePath = normalize(pathname === "/" ? "/index.html" : pathname).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(WEB_DIR, safePath);
  // Traversal-Schutz: das aufgelöste Ziel muss innerhalb von web/ bleiben.
  if (!resolve(filePath).startsWith(WEB_DIR)) {
    sendError(res, 400, "bad path");
    return;
  }
  try {
    const data = await readFile(filePath);
    const type = STATIC_TYPES[extname(filePath)] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type, "Content-Length": data.length });
    res.end(data);
  } catch (err) {
    if (err.code === "ENOENT") {
      sendError(res, 404, "not found");
    } else {
      sendError(res, 500, "internal error");
    }
  }
}

// --- Auth: der Client schickt "Authorization: Bearer <token>", wobei <token> selbst
// schon sha256(passphrase) ist (siehe web/app.js) — der Server sieht die rohe Passphrase
// nur einmal beim eigenen Start (aus LEAF_PASSPHRASE), nie vom Client. Verglichen wird
// nochmal gehasht, damit ein Timing-Angriff nicht direkt den nutzbaren Bearer-Wert verrät.

function hashToken(token) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function safeEqual(a, b) {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function extractBearer(req) {
  const header = req.headers["authorization"] || "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1].trim() : null;
}

/** Prüft den Bearer-Token gegen die konfigurierte Passphrase. */
function checkAuth(req) {
  const token = extractBearer(req);
  if (!token) return false;
  return safeEqual(hashToken(token), EXPECTED_TOKEN_HASH);
}

// --- Body einlesen, mit Größenlimit ----------------------------------------------

function readJsonBody(req) {
  return new Promise((resolveBody, rejectBody) => {
    let size = 0;
    let tooLarge = false;
    const chunks = [];
    req.on("data", (chunk) => {
      if (tooLarge) return; // schon abgelehnt — Rest des Bodys einfach verwerfen
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        // Bewusst KEIN req.destroy() hier: das würde mit dem Schreiben der 413-Antwort
        // ins Rennen laufen und die Verbindung manchmal abrupt kappen, bevor der Client
        // die Antwort überhaupt sieht. Einfach aufhören zu sammeln und die Verbindung
        // sich selbst leeren lassen reicht.
        tooLarge = true;
        rejectBody(Object.assign(new Error("payload too large"), { code: "TOO_LARGE" }));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (tooLarge) return; // bereits abgelehnt, nicht nochmal auflösen
      try {
        resolveBody(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch {
        rejectBody(Object.assign(new Error("invalid json"), { code: "BAD_JSON" }));
      }
    });
    req.on("error", rejectBody);
  });
}

function sanitizeField(value) {
  if (typeof value !== "string") return "";
  return value.slice(0, MAX_FIELD_LEN);
}

// --- Routen ------------------------------------------------------------------------
// Beide Endpunkte verlangen jetzt denselben Bearer-Token — ohne Passphrase gibt es weder
// Lesen noch Schreiben. Vorher durfte GET ohne Auth lesen, das war die eigentliche Lücke.

async function handleGetStatus(req, res) {
  if (!checkAuth(req)) {
    sendError(res, 401, "missing or wrong passphrase");
    return;
  }
  sendJson(res, 200, await store.getStatus());
}

async function handlePutSlot(req, res, slot) {
  if (slot !== "a" && slot !== "b") {
    sendError(res, 400, "slot must be 'a' or 'b'");
    return;
  }
  if (!checkAuth(req)) {
    sendError(res, 401, "missing or wrong passphrase");
    return;
  }
  if (isRateLimited()) {
    sendError(res, 429, "too many writes, slow down");
    return;
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch (err) {
    sendError(res, err.code === "TOO_LARGE" ? 413 : 400, err.message);
    return;
  }

  const payload = {
    message: sanitizeField(body.message),
    activity: sanitizeField(body.activity),
    place: sanitizeField(body.place),
    theme: sanitizeField(body.theme),
    reaction: sanitizeField(body.reaction),
  };

  const saved = await store.putSlot(slot, payload);
  sendJson(res, 200, saved);
}

// --- Server --------------------------------------------------------------------

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const { pathname } = url;

  // Preflight für Browser-Fetches mit Authorization-Header.
  if (req.method === "OPTIONS" && pathname.startsWith("/api/")) {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
    });
    res.end();
    return;
  }

  const statusMatch = /^\/api\/status(?:\/([^/]+))?$/.exec(pathname);
  if (statusMatch) {
    const [, slot] = statusMatch;
    try {
      if (req.method === "GET" && !slot) {
        await handleGetStatus(req, res);
      } else if (req.method === "PUT" && slot) {
        await handlePutSlot(req, res, slot);
      } else {
        sendError(res, 405, "method not allowed");
      }
    } catch (err) {
      console.error(err);
      sendError(res, 500, "internal error");
    }
    return;
  }

  if (req.method === "GET") {
    await serveStatic(req, res, pathname);
    return;
  }

  sendError(res, 405, "method not allowed");
});

server.listen(PORT, () => {
  console.log(`Leaf-Server läuft auf http://localhost:${PORT}`);
});
