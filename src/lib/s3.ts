import { requireAdminActionUser } from "@/lib/auth/require-admin";
import { env } from "@/env.mjs";
import { AwsClient } from "aws4fetch";

/**
 * `admin-session` — caller must be a logged-in admin (default).
 * `trusted-server` — route already authenticated (e.g. Velo API key).
 */
export type MediaWriteAuth = "admin-session" | "trusted-server";

async function assertMediaWriteAuth(auth: MediaWriteAuth = "admin-session") {
  if (auth === "trusted-server") return;
  await requireAdminActionUser();
}

/**
 * Hub media storage on Cloudflare R2.
 *
 * - Browser direct uploads: aws4fetch presigned PUT (S3 API)
 * - Worker put/get/delete: R2 binding (no S3 signature — avoids 401s from
 *   aws4fetch + global_fetch_strictly_public on Workers)
 *
 * SSR Tex uses Supabase Storage instead; Hub cannot copy that path 1:1.
 */

type R2BucketLike = {
  put: (
    key: string,
    value: ArrayBuffer | ArrayBufferView | string | null | ReadableStream,
    options?: {
      httpMetadata?: { contentType?: string; cacheControl?: string };
    },
  ) => Promise<unknown>;
  get: (key: string) => Promise<{
    size: number;
    body?: ReadableStream | null;
    httpMetadata?: { contentType?: string };
    arrayBuffer: () => Promise<ArrayBuffer>;
  } | null>;
  head?: (key: string) => Promise<{
    size: number;
    httpMetadata?: { contentType?: string };
  } | null>;
  delete: (keys: string | string[]) => Promise<void>;
};

async function getCloudflareEnv(): Promise<Record<string, unknown> | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env: cfEnv } = await getCloudflareContext({ async: true });
    return (cfEnv as Record<string, unknown> | undefined) ?? null;
  } catch {
    return null;
  }
}

function missingMediaBucketError() {
  return new Error(
    "Media storage is not bound (MEDIA_BUCKET missing). Enable R2 on this Cloudflare account, create bucket spt-cdn, add the R2 binding, and redeploy.",
  );
}

function getAwsClient() {
  return new AwsClient({
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    service: "s3",
    region: "auto",
  });
}

function objectUrl(key: string) {
  const endpoint = env.S3_ENDPOINT.replace(/\/$/, "");
  const bucket = env.NEXT_PUBLIC_S3_BUCKET;
  const encodedKey = key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${endpoint}/${bucket}/${encodedKey}`;
}

function mediaProxyConfig(): { baseUrl: string; secret: string } | null {
  const baseUrl = env.R2_MEDIA_PROXY_URL?.replace(/\/$/, "");
  const secret = env.R2_MEDIA_PROXY_SECRET?.trim();
  if (!baseUrl || !secret) return null;
  return { baseUrl, secret };
}

/** True when server can stage/put via binding or authenticated media proxy. */
export function hasServerMediaWritePath(): boolean {
  return Boolean(mediaProxyConfig());
}

async function proxyFetch(
  pathWithQuery: string,
  init: RequestInit & { method: string },
): Promise<Response> {
  const proxy = mediaProxyConfig();
  if (!proxy) {
    throw new Error("R2 media proxy is not configured.");
  }
  return fetch(`${proxy.baseUrl}${pathWithQuery}`, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${proxy.secret}`,
    },
  });
}

function toArrayBuffer(body: Buffer | Uint8Array | string | ArrayBuffer) {
  if (typeof body === "string") {
    return new TextEncoder().encode(body);
  }
  if (body instanceof ArrayBuffer) return body;
  if (Buffer.isBuffer(body)) {
    return body.buffer.slice(
      body.byteOffset,
      body.byteOffset + body.byteLength,
    );
  }
  return body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength);
}

export type PutObjectParams = {
  Bucket: string;
  Key: string;
  Body: Buffer | Uint8Array | string | ArrayBuffer;
  ContentType?: string;
  CacheControl?: string;
};

/** Browser staging upload — S3 presigned PUT (no Content-Type in signature). */
export async function createPresignedPutUrl(params: {
  key: string;
  contentType: string;
  expiresInSeconds?: number;
  auth?: MediaWriteAuth;
}) {
  await assertMediaWriteAuth(params.auth ?? "admin-session");
  const expires = params.expiresInSeconds ?? 60 * 10;
  const url = `${objectUrl(params.key)}?X-Amz-Expires=${expires}`;

  const signed = await getAwsClient().sign(url, {
    method: "PUT",
    aws: { signQuery: true },
  });

  return String(signed.url);
}

export async function putObject(
  params: PutObjectParams,
  options?: { auth?: MediaWriteAuth },
) {
  await assertMediaWriteAuth(options?.auth ?? "admin-session");

  const cfEnv = await getCloudflareEnv();
  const r2 = (cfEnv?.MEDIA_BUCKET as R2BucketLike | undefined) ?? null;
  if (r2) {
    await r2.put(params.Key, toArrayBuffer(params.Body), {
      httpMetadata: {
        contentType: params.ContentType,
        cacheControl: params.CacheControl,
      },
    });
    return { etag: null as string | null };
  }

  // Running on Cloudflare without MEDIA_BUCKET — S3 fallback returns 401 on Workers.
  if (cfEnv) {
    throw missingMediaBucketError();
  }

  const headers: Record<string, string> = {};
  if (params.ContentType) headers["Content-Type"] = params.ContentType;
  if (params.CacheControl) headers["Cache-Control"] = params.CacheControl;
  const body = toArrayBuffer(params.Body);
  // R2 S3 API requires Content-Length (411 MissingContentLength without it).
  // Undici/aws4fetch can omit it for some ArrayBuffer bodies on Vercel.
  const byteLength =
    typeof body === "string" ? Buffer.byteLength(body) : body.byteLength;
  headers["Content-Length"] = String(byteLength);

  // Vercel / Node: prefer authenticated Worker+R2 binding proxy when configured.
  // Stale R2 S3 API tokens return 401 Unauthorized against Cloudflare R2.
  const proxy = mediaProxyConfig();
  if (proxy) {
    const res = await proxyFetch(
      `/object?key=${encodeURIComponent(params.Key)}`,
      { method: "PUT", headers, body },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `R2 put failed (${res.status})${text ? `: ${text.slice(0, 200)}` : ""}`,
      );
    }
    return { etag: res.headers.get("etag") };
  }

  const res = await getAwsClient().fetch(objectUrl(params.Key), {
    method: "PUT",
    headers,
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `R2 put failed (${res.status})${text ? `: ${text.slice(0, 200)}` : ""}`,
    );
  }

  return { etag: res.headers.get("etag") };
}

export type ObjectMeta = {
  size: number;
  contentType: string | null;
};

/** Metadata only — no image bytes through the host. */
export async function headObjectMeta(params: {
  key: string;
  auth?: MediaWriteAuth;
}): Promise<ObjectMeta> {
  await assertMediaWriteAuth(params.auth ?? "admin-session");

  const cfEnv = await getCloudflareEnv();
  const r2 = (cfEnv?.MEDIA_BUCKET as R2BucketLike | undefined) ?? null;
  if (r2?.head) {
    const obj = await r2.head(params.key);
    if (!obj) throw new Error("Uploaded file not found. Try uploading again.");
    return {
      size: obj.size,
      contentType: obj.httpMetadata?.contentType ?? null,
    };
  }

  if (cfEnv && !r2) {
    throw missingMediaBucketError();
  }

  const proxy = mediaProxyConfig();
  const res = proxy
    ? await proxyFetch(`/object?key=${encodeURIComponent(params.key)}`, {
        method: "HEAD",
      })
    : await getAwsClient().fetch(objectUrl(params.key), { method: "HEAD" });

  if (!res.ok) {
    throw new Error(
      res.status === 404
        ? "Uploaded file not found. Try uploading again."
        : `R2 head failed (${res.status}).`,
    );
  }

  return {
    size: Number(res.headers.get("content-length") || 0),
    contentType: res.headers.get("content-type"),
  };
}

/**
 * Copy staging → final inside R2 (Worker promote or binding).
 * Keeps Fluid Active CPU low: Vercel only sends JSON keys.
 */
export async function promoteObject(params: {
  fromKey: string;
  toKey: string;
  contentType?: string;
  cacheControl?: string;
  deleteSource?: boolean;
  auth?: MediaWriteAuth;
}): Promise<ObjectMeta> {
  await assertMediaWriteAuth(params.auth ?? "admin-session");
  const deleteSource = params.deleteSource !== false;

  const cfEnv = await getCloudflareEnv();
  const r2 = (cfEnv?.MEDIA_BUCKET as R2BucketLike | undefined) ?? null;
  if (r2) {
    const src = await r2.get(params.fromKey);
    if (!src) throw new Error("Uploaded file not found. Try uploading again.");
    const contentType =
      params.contentType ||
      src.httpMetadata?.contentType ||
      "application/octet-stream";
    const body = src.body ?? (await src.arrayBuffer());
    await r2.put(params.toKey, body, {
      httpMetadata: {
        contentType,
        cacheControl:
          params.cacheControl || "public, max-age=31536000, immutable",
      },
    });
    if (deleteSource) await r2.delete(params.fromKey);
    return { size: src.size, contentType };
  }

  if (cfEnv) {
    throw missingMediaBucketError();
  }

  const proxy = mediaProxyConfig();
  if (proxy) {
    const res = await proxyFetch("/promote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fromKey: params.fromKey,
        toKey: params.toKey,
        contentType: params.contentType,
        cacheControl:
          params.cacheControl || "public, max-age=31536000, immutable",
        deleteSource,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        res.status === 404
          ? "Uploaded file not found. Try uploading again."
          : `R2 promote failed (${res.status})${text ? `: ${text.slice(0, 200)}` : ""}`,
      );
    }
    const json = (await res.json().catch(() => ({}))) as {
      size?: number;
      contentType?: string;
    };
    return {
      size: Number(json.size ?? 0),
      contentType: json.contentType ?? params.contentType ?? null,
    };
  }

  // S3 CopyObject fallback (no proxy).
  const copySource = `/${env.NEXT_PUBLIC_S3_BUCKET}/${params.fromKey}`;
  const headers: Record<string, string> = {
    "x-amz-copy-source": copySource,
    "x-amz-metadata-directive": "REPLACE",
    "Cache-Control":
      params.cacheControl || "public, max-age=31536000, immutable",
  };
  if (params.contentType) headers["Content-Type"] = params.contentType;

  const copyRes = await getAwsClient().fetch(objectUrl(params.toKey), {
    method: "PUT",
    headers,
  });
  if (!copyRes.ok) {
    const text = await copyRes.text().catch(() => "");
    throw new Error(
      `R2 copy failed (${copyRes.status})${text ? `: ${text.slice(0, 200)}` : ""}`,
    );
  }
  if (deleteSource) {
    await deleteObjects({ keys: [params.fromKey], auth: params.auth });
  }
  return {
    size: 0,
    contentType: params.contentType ?? null,
  };
}

export async function getObjectBuffer(params: {
  key: string;
  maxBytes?: number;
  auth?: MediaWriteAuth;
}) {
  await assertMediaWriteAuth(params.auth ?? "admin-session");

  const cfEnv = await getCloudflareEnv();
  const r2 = (cfEnv?.MEDIA_BUCKET as R2BucketLike | undefined) ?? null;
  if (r2) {
    const obj = await r2.get(params.key);
    if (!obj) {
      throw new Error("Uploaded file not found. Try uploading again.");
    }
    if (params.maxBytes && obj.size > params.maxBytes) {
      throw new Error("Image is too large after upload. Compress and retry.");
    }
    const bytes = new Uint8Array(await obj.arrayBuffer());
    if (params.maxBytes && bytes.byteLength > params.maxBytes) {
      throw new Error("Image is too large after upload. Compress and retry.");
    }
    return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  if (cfEnv) {
    throw missingMediaBucketError();
  }

  const proxy = mediaProxyConfig();
  const res = proxy
    ? await proxyFetch(`/object?key=${encodeURIComponent(params.key)}`, {
        method: "GET",
      })
    : await getAwsClient().fetch(objectUrl(params.key), { method: "GET" });

  if (!res.ok) {
    throw new Error(`R2 get failed (${res.status}).`);
  }

  const declared = Number(res.headers.get("content-length") || 0);
  if (
    params.maxBytes &&
    Number.isFinite(declared) &&
    declared > 0 &&
    declared > params.maxBytes
  ) {
    try {
      await res.body?.cancel();
    } catch {
      /* ignore */
    }
    throw new Error("Image is too large after upload. Compress and retry.");
  }

  const bytes = new Uint8Array(await res.arrayBuffer());
  if (params.maxBytes && bytes.byteLength > params.maxBytes) {
    throw new Error("Image is too large after upload. Compress and retry.");
  }
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

export async function deleteObjects(params: {
  keys: string[];
  auth?: MediaWriteAuth;
}) {
  await assertMediaWriteAuth(params.auth ?? "admin-session");
  const keys = [...new Set(params.keys.map((k) => k.trim()).filter(Boolean))];
  if (keys.length === 0) return;

  const cfEnv = await getCloudflareEnv();
  const r2 = (cfEnv?.MEDIA_BUCKET as R2BucketLike | undefined) ?? null;
  if (r2) {
    await r2.delete(keys);
    return;
  }

  if (cfEnv) {
    throw missingMediaBucketError();
  }

  const proxy = mediaProxyConfig();
  if (proxy) {
    // Prefer query-key DELETE — some edges reject DELETE with a JSON body.
    await Promise.all(
      keys.map(async (key) => {
        const res = await proxyFetch(`/object?key=${encodeURIComponent(key)}`, {
          method: "DELETE",
        });
        if (!res.ok && res.status !== 404) {
          const text = await res.text().catch(() => "");
          throw new Error(
            `R2 delete failed (${res.status})${text ? `: ${text.slice(0, 200)}` : ""}`,
          );
        }
      }),
    );
    return;
  }

  const client = getAwsClient();
  await Promise.all(
    keys.map(async (key) => {
      const res = await client.fetch(objectUrl(key), { method: "DELETE" });
      if (!res.ok && res.status !== 404) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `R2 delete failed (${res.status})${text ? `: ${text.slice(0, 200)}` : ""}`,
        );
      }
    }),
  );
}

export const uploadImage = async (params: PutObjectParams) => {
  return putObject(params);
};
