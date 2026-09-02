#!/usr/bin/env node
/**
 * Production deploy: validate → OpenNext build → Workers deploy.
 * On Windows, skips remote R2 cache populate (timeouts); ISR repopulates on demand.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = "wrangler.workers.new-account.jsonc";
const isWindows = process.platform === "win32";
const skipPopulate =
  isWindows || process.env.SKIP_CACHE_POPULATE === "1";

function run(command, args, env = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: "inherit",
    shell: isWindows,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run("npm", ["run", "identity:validate"]);
run("node", [
  "scripts/validate-wrangler-production.mjs",
  config,
]);

run("npx", [
  "opennextjs-cloudflare",
  "build",
  "--config",
  config,
]);

if (skipPopulate) {
  if (isWindows) {
    console.warn(
      "[deploy] Windows: skipping remote R2 cache populate (use CI/Linux or SKIP_CACHE_POPULATE=0 to force).",
    );
  }
  run("npx", ["wrangler", "deploy", "--config", config], {
    OPEN_NEXT_DEPLOY: "true",
  });
} else {
  run("npx", ["opennextjs-cloudflare", "deploy", "--config", config]);
}

console.log("[deploy] Done.");
