/**
 * End-to-end validation for SPT Velo media + products path.
 * Uses DATABASE_URL + R2_MEDIA_PROXY_* from .env.local.
 * Creates a temporary Velo key if none is active (revokes it at end).
 */
const fs = require("fs");
const crypto = require("crypto");
const postgres = require("postgres");

/** Minimal valid 1x1 WebP (no sharp dependency). */
const TINY_WEBP = Buffer.from(
  "UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=",
  "base64",
);

function loadEnv() {
  const raw = fs.readFileSync(".env.local", "utf8");
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}

function hashApiKey(apiKey) {
  return crypto.createHash("sha256").update(apiKey).digest("hex");
}

function makeApiKey() {
  const publicSegment = crypto.randomBytes(4).toString("hex");
  const secretSegment = crypto.randomBytes(24).toString("base64url");
  return `velo_live_${publicSegment}_${secretSegment}`;
}

async function main() {
  const env = loadEnv();
  const site = "https://sripalanitextiles.com";
  const mediaBase = (env.R2_MEDIA_PROXY_URL || "").replace(/\/$/, "");
  const results = [];

  const check = (name, ok, detail) => {
    results.push({ name, ok, detail });
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  };

  // 1) Health
  {
    const r = await fetch(`${mediaBase}/health`);
    const j = await r.json().catch(() => ({}));
    check("media.health", r.ok && j.ok === true, `status=${r.status}`);
  }

  // 2) Site health
  {
    const r = await fetch(`${site}/api/health`);
    const j = await r.json().catch(() => ({}));
    check("site.health", r.ok && j.status === "ok", `status=${r.status}`);
  }

  const sql = postgres(env.DATABASE_URL, {
    prepare: false,
    ssl: "require",
    max: 1,
  });

  let tempKeyId = null;
  let apiKey = null;

  try {
    const existing = await sql`
      SELECT id, key_prefix
      FROM external_api_keys
      WHERE provider = 'velo' AND is_active = true AND revoked_at IS NULL
      ORDER BY created_at DESC
      LIMIT 1
    `;

    // Always create a disposable key for this validation run so we don't need plaintext of existing keys.
    apiKey = makeApiKey();
    const keyPrefix = apiKey.slice(0, 18);
    const keyHash = hashApiKey(apiKey);
    const [inserted] = await sql`
      INSERT INTO external_api_keys (id, provider, client_name, key_prefix, key_hash, is_active)
      VALUES (${crypto.randomUUID()}, 'velo', 'validation-probe', ${keyPrefix}, ${keyHash}, true)
      RETURNING id
    `;
    tempKeyId = inserted.id;
    check("velo.key.create", Boolean(tempKeyId), `id=${tempKeyId}`);

    // 3) products meta (read, no full cache bust)
    {
      const r = await fetch(`${site}/api/velo/products`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-velo-key": apiKey,
        },
        body: JSON.stringify({
          action: "meta",
          requestId: `validate-meta-${Date.now()}`,
          data: { type: "collections" },
        }),
      });
      const j = await r.json().catch(() => ({}));
      check(
        "velo.products.meta",
        r.ok && j.ok === true && Array.isArray(j.collections),
        `status=${r.status} collections=${j.collections?.length ?? 0}`,
      );
    }

    // 4) medias init → proxy PUT → complete
    const tinyWebp = TINY_WEBP;

    let storagePath = null;
    let mediaId = null;

    {
      const r = await fetch(`${site}/api/velo/medias/direct-upload/init`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-velo-key": apiKey,
        },
        body: JSON.stringify({
          fileName: "validate-probe.webp",
          contentType: "image/webp",
          fileSize: tinyWebp.length,
        }),
      });
      const j = await r.json().catch(() => ({}));
      const ok =
        r.status === 201 &&
        j.ok === true &&
        typeof j.storagePath === "string" &&
        (j.uploadMode === "proxy"
          ? Boolean(j.uploadUrl && j.uploadToken)
          : j.uploadMode === "worker" || j.uploadMode === "presigned");
      storagePath = j.storagePath;
      check(
        "velo.medias.init",
        ok,
        `status=${r.status} mode=${j.uploadMode} msg=${j.message || ""}`,
      );

      if (ok && j.uploadMode === "proxy") {
        const put = await fetch(j.uploadUrl, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${j.uploadToken}`,
            "Content-Type": "image/webp",
          },
          body: tinyWebp,
        });
        const putText = await put.text();
        check(
          "velo.medias.proxyPut",
          put.ok,
          `status=${put.status} body=${putText.slice(0, 120)}`,
        );
      } else if (ok && j.uploadMode === "worker") {
        const form = new FormData();
        form.append("storagePath", j.storagePath);
        form.append(
          "file",
          new Blob([tinyWebp], { type: "image/webp" }),
          "validate-probe.webp",
        );
        const stage = await fetch(
          `${site}/api/velo/medias/direct-upload/stage`,
          {
            method: "POST",
            headers: { "x-velo-key": apiKey },
            body: form,
          },
        );
        const sj = await stage.json().catch(() => ({}));
        check(
          "velo.medias.stageFallback",
          stage.ok && sj.ok === true,
          `status=${stage.status}`,
        );
      }
    }

    if (storagePath) {
      const r = await fetch(`${site}/api/velo/medias/direct-upload/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-velo-key": apiKey,
        },
        body: JSON.stringify({
          storagePath,
          fileName: "validate-probe.webp",
        }),
      });
      const j = await r.json().catch(() => ({}));
      mediaId = j.mediaId || j.featuredImageMediaId;
      check(
        "velo.medias.complete",
        r.status === 201 && j.ok === true && Boolean(mediaId),
        `status=${r.status} mediaId=${mediaId || ""}`,
      );
    } else {
      check("velo.medias.complete", false, "skipped — no storagePath");
    }

    // 5) Unauthorized rejection
    {
      const r = await fetch(`${site}/api/velo/medias/direct-upload/init`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-velo-key": "bad" },
        body: JSON.stringify({
          fileName: "x.webp",
          contentType: "image/webp",
          fileSize: 100,
        }),
      });
      check("velo.medias.unauthorized", r.status === 401, `status=${r.status}`);
    }

    // Cleanup media row if created (leave R2 object; lifecycle can purge staging leftovers)
    if (mediaId) {
      await sql`DELETE FROM medias WHERE id = ${mediaId}`;
      check("cleanup.mediaRow", true, `deleted ${mediaId}`);
    }
  } finally {
    if (tempKeyId) {
      await sql`
        UPDATE external_api_keys
        SET is_active = false, revoked_at = now()
        WHERE id = ${tempKeyId}
      `;
      check("cleanup.veloKey", true, `revoked ${tempKeyId}`);
    }
    await sql.end({ timeout: 5 });
  }

  const failed = results.filter((r) => !r.ok);
  console.log("\n--- summary ---");
  console.log(`passed=${results.filter((r) => r.ok).length} failed=${failed.length}`);
  if (failed.length) {
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
