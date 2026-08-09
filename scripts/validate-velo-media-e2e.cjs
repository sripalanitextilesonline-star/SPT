/**
 * Full live validation: parallel media uploads (promote path), category+product CRUD.
 */
const fs = require("fs");
const crypto = require("crypto");
const postgres = require("postgres");

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
  const stamp = Date.now();

  const check = (name, ok, detail) => {
    results.push({ name, ok, detail });
    console.log(
      `${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`,
    );
  };

  const callProducts = async (apiKey, action, data) => {
    const r = await fetch(`${site}/api/velo/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-velo-key": apiKey,
      },
      body: JSON.stringify({
        action,
        requestId: `validate-${action}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        data,
      }),
    });
    const j = await r.json().catch(() => ({}));
    return { r, j };
  };

  const uploadOne = async (apiKey, label) => {
    const t0 = Date.now();
    const initRes = await fetch(`${site}/api/velo/medias/direct-upload/init`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-velo-key": apiKey,
      },
      body: JSON.stringify({
        fileName: `${label}-${stamp}.webp`,
        contentType: "image/webp",
        fileSize: TINY_WEBP.length,
      }),
    });
    const init = await initRes.json().catch(() => ({}));
    if (
      !initRes.ok ||
      !init.ok ||
      init.uploadMode !== "proxy" ||
      !init.uploadUrl ||
      !init.uploadToken
    ) {
      throw new Error(`init failed status=${initRes.status}`);
    }

    const put = await fetch(init.uploadUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${init.uploadToken}`,
        "Content-Type": "image/webp",
      },
      body: TINY_WEBP,
    });
    if (!put.ok) throw new Error(`proxy put failed status=${put.status}`);

    const doneRes = await fetch(
      `${site}/api/velo/medias/direct-upload/complete`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-velo-key": apiKey,
        },
        body: JSON.stringify({
          storagePath: init.storagePath,
          fileName: `${label}-${stamp}.webp`,
        }),
      },
    );
    const done = await doneRes.json().catch(() => ({}));
    const mediaId = done.mediaId || done.featuredImageMediaId;
    if (!doneRes.ok || !done.ok || !mediaId) {
      throw new Error(
        `complete failed status=${doneRes.status} msg=${done.message || ""}`,
      );
    }
    return {
      mediaId,
      promoted: done.promoted === true,
      ms: Date.now() - t0,
    };
  };

  {
    const r = await fetch(`${mediaBase}/health`);
    const j = await r.json().catch(() => ({}));
    check(
      "media.health",
      r.ok && j.ok === true,
      `status=${r.status} promote=${j.promote === true}`,
    );
  }
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
  const mediaIds = [];
  let collectionId = null;
  let productId = null;
  const externalProductId = `VALIDATE-${stamp}`;

  try {
    apiKey = makeApiKey();
    const keyPrefix = apiKey.slice(0, 18);
    const keyHash = hashApiKey(apiKey);
    const [inserted] = await sql`
      INSERT INTO external_api_keys (id, provider, client_name, key_prefix, key_hash, is_active)
      VALUES (${crypto.randomUUID()}, 'velo', 'validation-industry-probe', ${keyPrefix}, ${keyHash}, true)
      RETURNING id
    `;
    tempKeyId = inserted.id;
    check("velo.key.create", Boolean(tempKeyId), `id=${tempKeyId}`);

    // Parallel 4-photo industry upload
    const parallelStarted = Date.now();
    let parallel;
    try {
      parallel = await Promise.all([
        uploadOne(apiKey, "p1"),
        uploadOne(apiKey, "p2"),
        uploadOne(apiKey, "p3"),
        uploadOne(apiKey, "p4"),
      ]);
    } catch (e) {
      check(
        "velo.medias.parallel4",
        false,
        e instanceof Error ? e.message : String(e),
      );
      parallel = [];
    }
    const parallelMs = Date.now() - parallelStarted;
    if (parallel.length === 4) {
      mediaIds.push(...parallel.map((p) => p.mediaId));
      const allPromoted = parallel.every((p) => p.promoted);
      check(
        "velo.medias.parallel4",
        true,
        `ms=${parallelMs} promoted=${allPromoted} ids=${mediaIds.length}`,
      );
      check(
        "velo.medias.promoted",
        allPromoted,
        allPromoted
          ? "complete used in-R2 promote"
          : "fell back to download path — redeploy spt-media + Vercel",
      );
      check(
        "velo.medias.parallelBudget",
        parallelMs < 60000,
        `ms=${parallelMs} (expect <60s for tiny files)`,
      );
    }

    // Category with featured image (no base64)
    if (mediaIds[0]) {
      const { r, j } = await callProducts(apiKey, "upsertCollection", {
        name: `Validate Cat ${stamp}`,
        description: "Automated validation category with image",
        featuredImageMediaId: mediaIds[0],
      });
      collectionId = j.collection?.id;
      check(
        "velo.category.createWithImage",
        r.ok &&
          j.ok === true &&
          Boolean(collectionId) &&
          j.collection?.featuredImageId === mediaIds[0],
        `status=${r.status} id=${collectionId || ""} featured=${j.collection?.featuredImageId || ""}`,
      );
    } else {
      check("velo.category.createWithImage", false, "no media");
    }

    // Product with second media
    if (collectionId && mediaIds[1]) {
      const { r, j } = await callProducts(apiKey, "upsert", {
        externalProductId,
        name: `Validate Product ${stamp}`,
        description: "Automated validation product",
        collectionId,
        tags: ["validate"],
        badge: null,
        rating: "4",
        price: "999",
        stock: 1,
        isDraft: true,
        featuredImageMediaId: mediaIds[1],
      });
      productId = j.product?.productId;
      check(
        "velo.product.upsert",
        r.ok && j.ok === true && Boolean(productId),
        `status=${r.status} productId=${productId || ""}`,
      );
    } else {
      check("velo.product.upsert", false, "missing collection/media");
    }

    if (productId) {
      const { r, j } = await callProducts(apiKey, "list", {
        search: `Validate Product ${stamp}`,
        draft: "all",
        page: 1,
        pageSize: 20,
      });
      const rows = j.products || [];
      const found = rows.some((p) => p.productId === productId);
      check("velo.product.list", r.ok && j.ok === true && found, `rows=${rows.length}`);
    }

    if (productId) {
      const { r, j } = await callProducts(apiKey, "delete", {
        productId,
        externalProductId,
      });
      check(
        "velo.product.delete",
        r.ok && j.ok === true,
        `status=${r.status} msg=${j.message || ""}`,
      );
      productId = null;
    }

    if (collectionId) {
      let done = false;
      let lastMsg = "";
      for (let i = 0; i < 5; i += 1) {
        const { r, j } = await callProducts(apiKey, "deleteCollection", {
          id: collectionId,
          batchSize: 10,
        });
        lastMsg = j.message || "";
        if (
          r.ok &&
          j.ok === true &&
          (j.done === true || j.collectionDeleted === true)
        ) {
          done = true;
          break;
        }
        if (!r.ok || j.ok === false) {
          check(
            "velo.category.delete",
            false,
            `status=${r.status} msg=${lastMsg}`,
          );
          break;
        }
      }
      if (done) {
        check("velo.category.delete", true, lastMsg || "deleted");
        collectionId = null;
      } else if (!results.some((x) => x.name === "velo.category.delete")) {
        check("velo.category.delete", false, `not done: ${lastMsg}`);
      }
    }

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
      check("velo.unauthorized", r.status === 401, `status=${r.status}`);
    }
  } finally {
    try {
      if (productId) {
        await sql`DELETE FROM products WHERE id = ${productId}`;
      }
      if (collectionId) {
        await sql`UPDATE products SET collection_id = NULL WHERE collection_id = ${collectionId}`;
        await sql`DELETE FROM collections WHERE id = ${collectionId}`;
      }
      for (const mediaId of mediaIds) {
        const stillUsed = await sql`
          SELECT id FROM collections WHERE featured_image_id = ${mediaId} LIMIT 1
        `;
        const stillProd = await sql`
          SELECT id FROM products WHERE featured_image_id = ${mediaId} LIMIT 1
        `;
        if (stillUsed.length === 0 && stillProd.length === 0) {
          await sql`DELETE FROM medias WHERE id = ${mediaId}`;
        }
      }
      check("cleanup.mediaDb", true, `checked=${mediaIds.length}`);
    } catch (e) {
      check("cleanup.db", false, e instanceof Error ? e.message : String(e));
    }

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
  console.log(
    `passed=${results.filter((r) => r.ok).length} failed=${failed.length}`,
  );
  if (failed.length) {
    for (const f of failed) console.log(`  - ${f.name}: ${f.detail || ""}`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
