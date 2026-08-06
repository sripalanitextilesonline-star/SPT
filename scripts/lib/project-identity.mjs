import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const identityPath = path.join(root, "project.identity.json");

let cachedIdentity;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function getRepoRoot() {
  return root;
}

export function getProjectIdentity() {
  if (!cachedIdentity) {
    cachedIdentity = readJson(identityPath);
  }
  return cachedIdentity;
}

export function getProjectIdentityPath() {
  return identityPath;
}

export function resolveFromRoot(...segments) {
  return path.join(root, ...segments);
}

export function normalizeOrigin(value) {
  return String(value || "").trim().replace(/\/$/, "");
}

export function getCanonicalSiteUrl() {
  return normalizeOrigin(getProjectIdentity().site.canonicalUrl);
}

export function getAuthRedirectUrls() {
  return getProjectIdentity().site.authRedirectOrigins.map(
    (origin) => `${normalizeOrigin(origin)}/auth/callback`,
  );
}

export function isAllowedLocalOrigin(origin) {
  const normalized = normalizeOrigin(origin);
  return getProjectIdentity().site.localOrigins
    .map(normalizeOrigin)
    .includes(normalized);
}

export function fail(message) {
  console.error(`[project-identity] ${message}`);
  process.exit(1);
}
