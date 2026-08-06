/**
 * Print the env shape needed for Sri Palani Textiles R2.
 */
import { getProjectIdentity } from "./lib/project-identity.mjs";

const identity = getProjectIdentity();
const accountId =
  process.env.NEW_R2_ACCOUNT_ID?.trim() || identity.cloudflare.accountId;
const accessKeyId = process.env.NEW_R2_ACCESS_KEY_ID?.trim();
const secretAccessKey = process.env.NEW_R2_SECRET_ACCESS_KEY?.trim();
const publicUrl =
  process.env.NEW_R2_PUBLIC_URL?.trim() || identity.cloudflare.r2.publicCdnUrl;
const bucket = process.env.NEW_R2_BUCKET?.trim() || identity.cloudflare.r2.bucket;
const workerName = identity.cloudflare.workers.storefront.name;
const workerConfig =
  identity.cloudflare.workers.storefront.configPaths[1] ||
  identity.cloudflare.workers.storefront.configPaths[0];

if (!accessKeyId || !secretAccessKey || !publicUrl) {
  console.error(`Missing env. Set:
  NEW_R2_ACCESS_KEY_ID
  NEW_R2_SECRET_ACCESS_KEY
  NEW_R2_PUBLIC_URL   (e.g. https://pub-xxxxx.r2.dev)
Optional:
  NEW_R2_ACCOUNT_ID   (default ${accountId})
  NEW_R2_BUCKET       (default ${bucket})
`);
  process.exit(1);
}

const secrets = {
  NEXT_PUBLIC_S3_BUCKET: bucket,
  NEXT_PUBLIC_S3_REGION: "auto",
  S3_ENDPOINT: `https://${accountId}.r2.cloudflarestorage.com`,
  S3_ACCESS_KEY_ID: accessKeyId,
  S3_SECRET_ACCESS_KEY: secretAccessKey,
  NEXT_PUBLIC_CDN_URL: publicUrl.replace(/\/$/, ""),
};

console.log(JSON.stringify(secrets, null, 2));
console.log(`
Next:
  1. Save JSON to a temp file (do not commit)
  2. npx wrangler secret bulk <file> --name ${workerName} --config ${workerConfig}
  3. Update .env.local with the same values
  4. npm run deploy:new
`);
