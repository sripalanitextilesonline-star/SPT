#!/usr/bin/env node
/**
 * Verify DATABASE_URL resolves to Supabase transaction pooler (6543) on aws-1.
 * Usage: node scripts/verify-db-url.mjs
 */
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

const TRANSACTION_POOLER_PORT = 6543;
const SESSION_POOLER_PORT = 5432;

function toHttpUrl(url) {
  return url.replace(/^postgresql:/i, "http:");
}

function normalizePoolerDatabaseUrl(url) {
  try {
    const parsed = new URL(toHttpUrl(url));
    if (!/\.pooler\.supabase\.com$/i.test(parsed.hostname)) {
      return { url, rewrites: [] };
    }

    const rewrites = [];
    if (/^aws-0-/i.test(parsed.hostname)) {
      parsed.hostname = parsed.hostname.replace(/^aws-0-/i, "aws-1-");
      rewrites.push("aws-0 host → aws-1");
    }

    const port = Number(parsed.port || SESSION_POOLER_PORT);
    if (port === SESSION_POOLER_PORT) {
      parsed.port = String(TRANSACTION_POOLER_PORT);
      rewrites.push(
        `:${SESSION_POOLER_PORT} session → :${TRANSACTION_POOLER_PORT} transaction`,
      );
    }

    return {
      url: parsed.toString().replace(/^http:/i, "postgresql:"),
      rewrites,
    };
  } catch {
    return { url, rewrites: [] };
  }
}

function resolveDatabaseUrl(raw) {
  const poolerOverride = process.env.SUPABASE_DB_POOLER_URL?.trim();
  if (poolerOverride) {
    return normalizePoolerDatabaseUrl(poolerOverride).url;
  }

  const url = (raw ?? process.env.DATABASE_URL ?? "").trim();
  if (!url) return url;

  if (/pooler\.supabase\.com/i.test(url)) {
    return normalizePoolerDatabaseUrl(url).url;
  }

  return url;
}

function describeDatabaseUrl(raw) {
  const url = resolveDatabaseUrl(raw);
  try {
    const parsed = new URL(toHttpUrl(url));
    return {
      host: parsed.host,
      port: parsed.port || String(SESSION_POOLER_PORT),
      pooler: /\.pooler\.supabase\.com$/i.test(parsed.hostname),
      url,
    };
  } catch {
    return { host: "", port: "", pooler: false, url };
  }
}

const info = describeDatabaseUrl(process.env.DATABASE_URL);

console.log("[verify-db-url]", {
  host: info.host,
  port: info.port,
  pooler: info.pooler,
});

let ok = true;

if (!info.url) {
  console.error("DATABASE_URL is empty.");
  ok = false;
} else if (!info.pooler) {
  console.error("DATABASE_URL is not a Supabase pooler URL.");
  ok = false;
} else if (info.port !== String(TRANSACTION_POOLER_PORT)) {
  console.error(
    `Expected transaction pooler port ${TRANSACTION_POOLER_PORT}, got ${info.port}.`,
  );
  ok = false;
} else if (!info.host.includes("aws-1-")) {
  console.warn(
    `[verify-db-url] Host is ${info.host} (SPT expects aws-1-ap-south-1).`,
  );
}

if (!ok) {
  process.exit(1);
}

console.log("Database URL OK for serverless transaction pooler.");
