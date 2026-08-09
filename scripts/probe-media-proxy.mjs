import { readFileSync } from "fs";
import { getProjectIdentity } from "./lib/project-identity.mjs";

const identity = getProjectIdentity();
const secret = readFileSync("scripts/.media-proxy-secret.tmp", "utf8").trim();
const defaultProxyUrl = "https://media.sripalanitextiles.com";
const base = (
  process.env.R2_MEDIA_PROXY_URL ||
  process.env.MEDIA_PROXY_BASE_URL ||
  defaultProxyUrl
).trim();

if (!base) {
  console.error(
    `Set R2_MEDIA_PROXY_URL or MEDIA_PROXY_BASE_URL before running this probe. Worker name: ${identity.cloudflare.workers.mediaProxy.name}`,
  );
  process.exit(1);
}

console.log(
  JSON.stringify({
    worker: identity.cloudflare.workers.mediaProxy.name,
    base,
  }),
);
const key = `healthcheck/proxy-probe-${Date.now()}.txt`;

const put = await fetch(`${base}/object?key=${encodeURIComponent(key)}`, {
  method: "PUT",
  headers: {
    Authorization: `Bearer ${secret}`,
    "Content-Type": "text/plain",
  },
  body: "proxy-ok",
});
const putText = await put.text();
console.log(JSON.stringify({ put: put.status, putText: putText.slice(0, 120) }));

const get = await fetch(`${base}/object?key=${encodeURIComponent(key)}`, {
  method: "GET",
  headers: { Authorization: `Bearer ${secret}` },
});
const getText = await get.text();
console.log(JSON.stringify({ get: get.status, getText }));

const del = await fetch(`${base}/object`, {
  method: "DELETE",
  headers: {
    Authorization: `Bearer ${secret}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ keys: [key] }),
});
console.log(JSON.stringify({ del: del.status, delText: (await del.text()).slice(0, 120) }));
