const fs = require("fs");
const script = JSON.parse(fs.readFileSync(".tmp-worker-script.json", "utf8"));
const code = `async () => {
  const script = ${JSON.stringify(script)};
  const metadata = {
    main_module: "index.js",
    bindings: [
      { type: "r2_bucket", name: "MEDIA_BUCKET", bucket_name: "spt-cdn" },
    ],
    compatibility_date: "2025-05-05",
    keep_bindings: ["secret_text"],
  };
  const b = "----FormBoundary" + Date.now();
  const body = [
    "--" + b,
    'Content-Disposition: form-data; name="metadata"',
    "Content-Type: application/json",
    "",
    JSON.stringify(metadata),
    "--" + b,
    'Content-Disposition: form-data; name="index.js"; filename="index.js"',
    "Content-Type: application/javascript+module",
    "",
    script,
    "--" + b + "--",
    "",
  ].join("\\r\\n");
  return cloudflare.request({
    method: "PUT",
    path: "/accounts/" + accountId + "/workers/scripts/spt-media",
    body,
    contentType: "multipart/form-data; boundary=" + b,
    rawBody: true,
  });
}`;
fs.writeFileSync(".tmp-mcp-deploy-code.js", code);
console.log("code bytes", Buffer.byteLength(code));
