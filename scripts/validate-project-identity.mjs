#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import dotenv from "dotenv";
import {
  fail,
  getProjectIdentity,
  getProjectIdentityPath,
  getRepoRoot,
  normalizeOrigin,
  resolveFromRoot,
} from "./lib/project-identity.mjs";

const root = getRepoRoot();
const identity = getProjectIdentity();
const strictCloudflareLogin = process.argv.includes("--strict-cloudflare-login");

dotenv.config({ path: resolveFromRoot(".env.local") });

function stripJsonc(raw) {
  return raw
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

function readJsonc(relativePath) {
  const absolutePath = resolveFromRoot(relativePath);
  return JSON.parse(stripJsonc(fs.readFileSync(absolutePath, "utf8")));
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function validateIdentityShape() {
  assert(fs.existsSync(getProjectIdentityPath()), "Missing project.identity.json");
  assert(identity.project.slug, "identity.project.slug is required");
  assert(identity.site.canonicalUrl, "identity.site.canonicalUrl is required");
  assert(identity.supabase.projectRef, "identity.supabase.projectRef is required");
  assert(identity.cloudflare.accountId, "identity.cloudflare.accountId is required");
  assert(identity.github.remoteUrl, "identity.github.remoteUrl is required");
}

function validateEnvLocal() {
  const envPath = resolveFromRoot(".env.local");
  if (!fs.existsSync(envPath)) return;

  const envSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const envSupabaseRef = process.env.NEXT_PUBLIC_SUPABASE_PROJECT_REF?.trim();
  const envSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const envBucket = process.env.NEXT_PUBLIC_S3_BUCKET?.trim();
  const envEndpoint = process.env.S3_ENDPOINT?.trim();
  const envCdn = process.env.NEXT_PUBLIC_CDN_URL?.trim();

  assert(
    !envSupabaseRef || envSupabaseRef === identity.supabase.projectRef,
    `.env.local NEXT_PUBLIC_SUPABASE_PROJECT_REF must be ${identity.supabase.projectRef}`,
  );
  assert(
    !envSupabaseUrl || envSupabaseUrl === identity.supabase.url,
    `.env.local NEXT_PUBLIC_SUPABASE_URL must be ${identity.supabase.url}`,
  );
  assert(
    !envBucket || envBucket === identity.cloudflare.r2.bucket,
    `.env.local NEXT_PUBLIC_S3_BUCKET must be ${identity.cloudflare.r2.bucket}`,
  );
  assert(
    !envEndpoint || envEndpoint === identity.cloudflare.r2.endpoint,
    `.env.local S3_ENDPOINT must be ${identity.cloudflare.r2.endpoint}`,
  );
  assert(
    !envCdn || envCdn === identity.cloudflare.r2.publicCdnUrl,
    `.env.local NEXT_PUBLIC_CDN_URL must be ${identity.cloudflare.r2.publicCdnUrl}`,
  );

  if (envSiteUrl) {
    const allowedSiteUrls = new Set([
      identity.site.canonicalUrl,
      ...identity.site.localOrigins,
    ].map(normalizeOrigin));
    assert(
      allowedSiteUrls.has(normalizeOrigin(envSiteUrl)),
      `.env.local NEXT_PUBLIC_SITE_URL must be one of: ${[...allowedSiteUrls].join(", ")}`,
    );
  }
}

function validateWranglerConfigs() {
  for (const configPath of identity.cloudflare.workers.storefront.configPaths) {
    const config = readJsonc(configPath);
    assert(
      config.name === identity.cloudflare.workers.storefront.name,
      `${configPath} name must be ${identity.cloudflare.workers.storefront.name}`,
    );
    assert(
      config.account_id === identity.cloudflare.accountId,
      `${configPath} account_id must be ${identity.cloudflare.accountId}`,
    );
    const buckets = new Map(
      (config.r2_buckets || []).map((bucket) => [bucket.binding, bucket.bucket_name]),
    );
    assert(
      buckets.get("MEDIA_BUCKET") === identity.cloudflare.r2.bucket,
      `${configPath} MEDIA_BUCKET must be ${identity.cloudflare.r2.bucket}`,
    );
    assert(
      buckets.get("NEXT_INC_CACHE_R2_BUCKET") === identity.cloudflare.r2.cacheBucket,
      `${configPath} NEXT_INC_CACHE_R2_BUCKET must be ${identity.cloudflare.r2.cacheBucket}`,
    );
  }

  for (const configPath of identity.cloudflare.workers.mediaProxy.configPaths) {
    const config = readJsonc(configPath);
    assert(
      config.name === identity.cloudflare.workers.mediaProxy.name,
      `${configPath} name must be ${identity.cloudflare.workers.mediaProxy.name}`,
    );
    assert(
      config.account_id === identity.cloudflare.accountId,
      `${configPath} account_id must be ${identity.cloudflare.accountId}`,
    );
    const mediaBucket = (config.r2_buckets || []).find(
      (bucket) => bucket.binding === "MEDIA_BUCKET",
    );
    assert(
      mediaBucket?.bucket_name === identity.cloudflare.r2.bucket,
      `${configPath} MEDIA_BUCKET must be ${identity.cloudflare.r2.bucket}`,
    );
  }
}

function validateSupabaseConfig() {
  const configPath = resolveFromRoot(identity.supabase.configPath);
  if (!fs.existsSync(configPath)) return;
  const raw = fs.readFileSync(configPath, "utf8");

  assert(
    raw.includes(`site_url = "${identity.site.canonicalUrl}"`),
    `${identity.supabase.configPath} auth.site_url must be ${identity.site.canonicalUrl}`,
  );

  for (const origin of identity.site.authRedirectOrigins) {
    const callback = `${normalizeOrigin(origin)}/auth/callback`;
    assert(
      raw.includes(`"${callback}"`),
      `${identity.supabase.configPath} missing auth callback ${callback}`,
    );
  }
}

function validateGitRemote() {
  try {
    const remote = execFileSync("git", ["remote", "get-url", "origin"], {
      cwd: root,
      encoding: "utf8",
    }).trim();
    assert(
      remote === identity.github.remoteUrl,
      `git origin must be ${identity.github.remoteUrl} (found ${remote})`,
    );
  } catch (error) {
    fail(`Unable to validate git remote: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function validateForbiddenRefs() {
  const criticalFiles = [
    "src/lib/auth/site-urls.ts",
    "scripts/setup-auth-config.mjs",
    "scripts/verify-auth.mjs",
    "scripts/validate-wrangler-production.mjs",
    "scripts/probe-media-proxy.mjs",
    "wrangler.workers.jsonc",
    "wrangler.workers.new-account.jsonc",
    "workers/r2-media-proxy/wrangler.jsonc",
    "supabase/config.toml",
    "vercel.json",
  ];

  const forbiddenStrings = [
    ...identity.forbidden.domains,
    ...identity.forbidden.supabaseProjectRefs,
    ...identity.forbidden.cloudflareAccountIds,
    ...identity.forbidden.workerNames,
    ...identity.forbidden.githubRepos,
  ];

  for (const relativePath of criticalFiles) {
    const absolutePath = resolveFromRoot(relativePath);
    if (!fs.existsSync(absolutePath)) continue;
    const raw = fs.readFileSync(absolutePath, "utf8");
    for (const forbidden of forbiddenStrings) {
      assert(
        !raw.includes(forbidden),
        `${relativePath} still contains forbidden identity value: ${forbidden}`,
      );
    }
  }
}

function validateCloudflareLogin() {
  if (!strictCloudflareLogin) return;

  try {
    const output = execFileSync("npx", ["wrangler", "whoami"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32",
    });
    assert(
      output.includes(identity.cloudflare.accountId),
      `Wrangler login is not scoped to Cloudflare account ${identity.cloudflare.accountId}`,
    );
  } catch (error) {
    fail(
      `Strict Cloudflare login validation failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

validateIdentityShape();
validateEnvLocal();
validateWranglerConfigs();
validateSupabaseConfig();
validateGitRemote();
validateForbiddenRefs();
validateCloudflareLogin();

console.log("[project-identity] OK");
