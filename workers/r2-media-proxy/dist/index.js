// workers/r2-media-proxy/src/index.ts
var MAX_BODY_BYTES = 8 * 1024 * 1024;
var TOKEN_PREFIX = "uv1";
var STAGING_PREFIX = "uploads/staging/";
var CORS_ORIGINS = /* @__PURE__ */ new Set([
  "https://software-saree-order.vercel.app",
  "https://sripalanitextiles.com",
  "https://www.sripalanitextiles.com",
  "http://localhost:3000",
  "https://localhost",
  "http://localhost",
  "capacitor://localhost"
]);
function corsHeaders(request) {
  const origin = request.headers.get("origin") ?? "";
  const allowOrigin = CORS_ORIGINS.has(origin) ? origin : "*";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, HEAD, PUT, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400"
  };
}
function jsonResponse(request, body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(request)
    }
  });
}
function unauthorized(request) {
  return jsonResponse(request, { error: "Unauthorized" }, 401);
}
function badRequest(request, message) {
  return jsonResponse(request, { error: message }, 400);
}
function extractBearer(request) {
  const header = request.headers.get("authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : header.trim();
}
function sanitizeKey(raw) {
  if (!raw)
    return null;
  const key = decodeURIComponent(raw).trim();
  if (!key || key.includes("..") || key.includes("\\") || key.startsWith("/")) {
    return null;
  }
  return key;
}
function base64UrlToBytes(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - padded.length % 4);
  const binary = atob(padded + pad);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1)
    out[i] = binary.charCodeAt(i);
  return out;
}
function bytesToBase64Url(bytes) {
  const view = new Uint8Array(bytes);
  let binary = "";
  for (let i = 0; i < view.length; i += 1) {
    binary += String.fromCharCode(view[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
async function hmacSign(secret, payload) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload)
  );
  return bytesToBase64Url(sig);
}
function timingSafeEqualString(a, b) {
  if (a.length !== b.length)
    return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}
async function verifyUploadToken(token, expectedKey, secret) {
  const parts = token.split(".");
  if (parts.length !== 4)
    return false;
  const [prefix, expRaw, keyB64, sig] = parts;
  if (prefix !== TOKEN_PREFIX)
    return false;
  const exp = Number(expRaw);
  const now = Math.floor(Date.now() / 1e3);
  if (!Number.isFinite(exp) || exp < now)
    return false;
  let key;
  try {
    key = new TextDecoder().decode(base64UrlToBytes(keyB64));
  } catch {
    return false;
  }
  if (key !== expectedKey)
    return false;
  if (!key.startsWith(STAGING_PREFIX))
    return false;
  const payload = `${TOKEN_PREFIX}:${exp}:${key}`;
  const expectedSig = await hmacSign(secret, payload);
  return timingSafeEqualString(sig, expectedSig);
}
async function authorizeRequest(request, env, objectKey) {
  const expected = env.MEDIA_PROXY_SECRET?.trim();
  if (!expected)
    return null;
  const token = extractBearer(request);
  if (!token)
    return null;
  if (token === expected)
    return "server";
  if (objectKey && token.startsWith(`${TOKEN_PREFIX}.`)) {
    const ok = await verifyUploadToken(token, objectKey, expected);
    return ok ? "upload" : null;
  }
  return null;
}
function isSafeFinalKey(key) {
  if (!key.startsWith("uploads/"))
    return false;
  if (key.startsWith(STAGING_PREFIX))
    return false;
  if (key.includes("..") || key.includes("\\"))
    return false;
  return /^uploads\/[A-Za-z0-9/_-]+\.[a-z0-9]+$/i.test(key);
}
var src_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(request)
      });
    }
    if (request.method === "GET" && url.pathname === "/health") {
      return jsonResponse(request, { ok: true, promote: true });
    }
    if (request.method === "POST" && url.pathname === "/promote") {
      const auth2 = await authorizeRequest(request, env, null);
      if (auth2 !== "server")
        return unauthorized(request);
      const body = await request.json().catch(() => null);
      const fromKey = typeof body?.fromKey === "string" ? sanitizeKey(body.fromKey) : null;
      const toKey = typeof body?.toKey === "string" ? sanitizeKey(body.toKey) : null;
      if (!fromKey || !fromKey.startsWith(STAGING_PREFIX)) {
        return badRequest(request, "fromKey must be a staging key.");
      }
      if (!toKey || !isSafeFinalKey(toKey)) {
        return badRequest(request, "toKey must be a final uploads/ key.");
      }
      const src = await env.MEDIA_BUCKET.get(fromKey);
      if (!src) {
        return jsonResponse(request, { error: "Staging object not found." }, 404);
      }
      const contentType = typeof body?.contentType === "string" && body.contentType.trim() || src.httpMetadata?.contentType || "application/octet-stream";
      const cacheControl = typeof body?.cacheControl === "string" && body.cacheControl.trim() || "public, max-age=31536000, immutable";
      if (!src.body) {
        return badRequest(request, "Staging object has no body.");
      }
      await env.MEDIA_BUCKET.put(toKey, src.body, {
        httpMetadata: { contentType, cacheControl }
      });
      const deleteSource = body?.deleteSource !== false;
      if (deleteSource) {
        await env.MEDIA_BUCKET.delete(fromKey);
      }
      return jsonResponse(request, {
        ok: true,
        fromKey,
        toKey,
        size: src.size,
        contentType
      });
    }
    if (url.pathname !== "/object") {
      return badRequest(request, "Unknown path.");
    }
    const objectKey = sanitizeKey(url.searchParams.get("key"));
    const auth = await authorizeRequest(request, env, objectKey);
    if (!auth)
      return unauthorized(request);
    if (auth === "upload" && request.method !== "PUT") {
      return unauthorized(request);
    }
    if (request.method === "PUT") {
      const key = objectKey;
      if (!key)
        return badRequest(request, "Missing or invalid key.");
      const contentLength = Number(request.headers.get("content-length") || 0);
      if (Number.isFinite(contentLength) && contentLength > 0 && contentLength > MAX_BODY_BYTES) {
        return badRequest(request, "Body too large.");
      }
      const body = await request.arrayBuffer();
      if (body.byteLength === 0)
        return badRequest(request, "Empty body.");
      if (body.byteLength > MAX_BODY_BYTES) {
        return badRequest(request, "Body too large.");
      }
      const contentType = request.headers.get("content-type") || "application/octet-stream";
      const cacheControl = request.headers.get("cache-control") || void 0;
      await env.MEDIA_BUCKET.put(key, body, {
        httpMetadata: {
          contentType,
          cacheControl
        }
      });
      return jsonResponse(request, { ok: true, key });
    }
    if (request.method === "HEAD") {
      const key = objectKey;
      if (!key)
        return badRequest(request, "Missing or invalid key.");
      const obj = await env.MEDIA_BUCKET.head(key);
      if (!obj) {
        return new Response(null, {
          status: 404,
          headers: corsHeaders(request)
        });
      }
      const headers = new Headers(corsHeaders(request));
      const ct = obj.httpMetadata?.contentType;
      if (ct)
        headers.set("Content-Type", ct);
      headers.set("Content-Length", String(obj.size));
      return new Response(null, { status: 200, headers });
    }
    if (request.method === "GET") {
      const key = objectKey;
      if (!key)
        return badRequest(request, "Missing or invalid key.");
      const obj = await env.MEDIA_BUCKET.get(key);
      if (!obj) {
        return jsonResponse(request, { error: "Not found" }, 404);
      }
      const headers = new Headers(corsHeaders(request));
      const ct = obj.httpMetadata?.contentType;
      if (ct)
        headers.set("Content-Type", ct);
      headers.set("Content-Length", String(obj.size));
      return new Response(obj.body, { status: 200, headers });
    }
    if (request.method === "DELETE") {
      let keys = [];
      if (objectKey) {
        keys = [objectKey];
      } else {
        const json = await request.json().catch(() => null);
        if (!json || !Array.isArray(json.keys)) {
          return badRequest(request, "Expected { keys: string[] }.");
        }
        keys = [
          ...new Set(
            json.keys.filter((k) => typeof k === "string").map((k) => sanitizeKey(k)).filter((k) => Boolean(k))
          )
        ];
      }
      if (keys.length === 0)
        return badRequest(request, "No keys.");
      await env.MEDIA_BUCKET.delete(keys);
      return jsonResponse(request, { ok: true, deleted: keys.length });
    }
    return new Response("Method Not Allowed", {
      status: 405,
      headers: corsHeaders(request)
    });
  }
};
export {
  src_default as default
};
