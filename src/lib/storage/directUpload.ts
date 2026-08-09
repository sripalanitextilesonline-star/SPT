import { logServerError } from "@/lib/api/public-error";
import {
  STAGING_UPLOAD_LIMIT_BYTES,
  STAGING_UPLOAD_LIMIT_MB,
} from "@/lib/image/uploadLimits";
import {
  MAX_PROCESSED_IMAGE_BYTES,
  processUploadedImageBuffer,
} from "@/lib/image/processUpload";
import {
  createPresignedPutUrl,
  deleteObjects,
  getObjectBuffer,
  hasServerMediaWritePath,
  headObjectMeta,
  promoteObject,
  putObject,
  type MediaWriteAuth,
} from "@/lib/s3";
import db from "@/lib/supabase/db";
import { medias } from "@/lib/supabase/schema";
import { env } from "@/env.mjs";
import { nanoid } from "nanoid";
import {
  sanitizeExtension,
  sanitizeUploadFileName,
  toMediaAltText,
} from "./safeUploadFileName";
import { uploadMediaToR2 } from "./uploadMedia";
import {
  createMediaProxyUploadToken,
  mediaProxyUploadUrl,
} from "./velo-upload-token";

export type DirectUploadPurpose = "upload" | "product-draft" | "velo-product";
export type DirectUploadMode = "worker" | "presigned" | "proxy";

const STAGING_PREFIX = "uploads/staging/";

export { sanitizeExtension } from "./safeUploadFileName";

export function buildStagingPath(fileName: string): string {
  return `${STAGING_PREFIX}${nanoid()}.${sanitizeExtension(fileName)}`;
}

export function isValidStagingPath(path: string): boolean {
  if (!path.startsWith(STAGING_PREFIX)) return false;
  if (path.includes("..") || path.includes("\\")) return false;
  return /^uploads\/staging\/[A-Za-z0-9_-]+\.[a-z0-9]+$/i.test(path);
}

function buildFinalKey(purpose: DirectUploadPurpose, fileName: string): string {
  const extension = sanitizeExtension(fileName);
  const namePrefix =
    purpose === "product-draft"
      ? "product-draft"
      : purpose === "velo-product"
        ? "velo-product"
        : "upload";
  return `uploads/${namePrefix}-${nanoid()}.${extension}`;
}

function contentTypeFromFileName(fileName: string): string {
  const ext = sanitizeExtension(fileName).toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  return "application/octet-stream";
}

async function deleteStagingFile(
  storagePath: string,
  auth: MediaWriteAuth = "admin-session",
) {
  await deleteObjects({ keys: [storagePath], auth });
}

async function hasMediaBucketBinding(): Promise<boolean> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env: cfEnv } = await getCloudflareContext({ async: true });
    return Boolean(
      (cfEnv as Record<string, unknown> | undefined)?.MEDIA_BUCKET,
    );
  } catch {
    return false;
  }
}

function assertUploadLimits(params: { fileSize: number; contentType: string }) {
  if (params.fileSize <= 0) {
    throw new Error("File is empty.");
  }
  if (params.fileSize > STAGING_UPLOAD_LIMIT_BYTES) {
    throw new Error(
      `Each image must be ${STAGING_UPLOAD_LIMIT_MB} MB or smaller after compression.`,
    );
  }
  if (!params.contentType.startsWith("image/")) {
    throw new Error("Only image files are allowed.");
  }
}

export async function createDirectUploadSession(params: {
  fileName: string;
  contentType: string;
  fileSize: number;
  auth?: MediaWriteAuth;
  /** Prefer client→media-proxy PUT (skips Vercel Fluid for image bytes). */
  preferProxyUpload?: boolean;
}) {
  const auth = params.auth ?? "admin-session";
  assertUploadLimits(params);

  const storagePath = buildStagingPath(sanitizeUploadFileName(params.fileName));

  if (params.preferProxyUpload && hasServerMediaWritePath()) {
    try {
      const { token, expiresAt } = createMediaProxyUploadToken(storagePath);
      return {
        storagePath,
        uploadMode: "proxy" as DirectUploadMode,
        signedUrl: null as string | null,
        uploadUrl: mediaProxyUploadUrl(storagePath),
        uploadToken: token,
        uploadTokenExpiresAt: expiresAt,
      };
    } catch (error) {
      logServerError("directUpload/proxySession", error);
    }
  }

  if ((await hasMediaBucketBinding()) || hasServerMediaWritePath()) {
    return {
      storagePath,
      uploadMode: "worker" as DirectUploadMode,
      signedUrl: null as string | null,
      uploadUrl: null as string | null,
      uploadToken: null as string | null,
      uploadTokenExpiresAt: null as number | null,
    };
  }

  let signedUrl: string | null = null;
  let error: unknown = null;
  try {
    signedUrl = await createPresignedPutUrl({
      key: storagePath,
      contentType: params.contentType || "application/octet-stream",
      expiresInSeconds: 60 * 10,
      auth,
    });
  } catch (err) {
    error = err;
  }

  if (!signedUrl) {
    logServerError("directUpload/createSession", error);
    throw new Error("Could not create upload session.");
  }

  return {
    storagePath,
    uploadMode: "presigned" as DirectUploadMode,
    signedUrl,
    uploadUrl: signedUrl,
    uploadToken: null as string | null,
    uploadTokenExpiresAt: null as number | null,
  };
}

export async function stageDirectUpload(params: {
  storagePath: string;
  body: ArrayBuffer | Uint8Array | Buffer;
  contentType: string;
  auth?: MediaWriteAuth;
}) {
  const auth = params.auth ?? "admin-session";
  if (!isValidStagingPath(params.storagePath)) {
    throw new Error("Invalid staging path.");
  }
  if (!params.contentType.startsWith("image/")) {
    throw new Error("Only image files are allowed.");
  }
  const size =
    params.body instanceof ArrayBuffer
      ? params.body.byteLength
      : params.body.byteLength;
  if (size <= 0) {
    throw new Error("File is empty.");
  }
  if (size > STAGING_UPLOAD_LIMIT_BYTES) {
    throw new Error(
      `Each image must be ${STAGING_UPLOAD_LIMIT_MB} MB or smaller after compression.`,
    );
  }

  await putObject(
    {
      Bucket: env.NEXT_PUBLIC_S3_BUCKET,
      Key: params.storagePath,
      Body: params.body,
      ContentType: params.contentType || "application/octet-stream",
    },
    { auth },
  );

  return { storagePath: params.storagePath };
}

/**
 * Finalize staging upload.
 * Preferred path: HEAD + in-R2 promote (no image bytes on Vercel).
 * Fallback: download + validate + re-upload (legacy / missing promote).
 */
export async function finalizeDirectUpload(params: {
  storagePath: string;
  originalFileName: string;
  purpose: DirectUploadPurpose;
  auth?: MediaWriteAuth;
}) {
  const auth = params.auth ?? "admin-session";
  if (!isValidStagingPath(params.storagePath)) {
    throw new Error("Invalid staging path.");
  }

  const stagingKey = params.storagePath;
  const safeName = sanitizeUploadFileName(params.originalFileName);
  const alt = toMediaAltText(params.originalFileName);
  const finalKey = buildFinalKey(params.purpose, safeName);
  const guessedType = contentTypeFromFileName(safeName);

  // Industry path: metadata check + Worker/R2 promote (tiny Vercel work).
  try {
    const meta = await headObjectMeta({ key: stagingKey, auth });
    if (!meta.size || meta.size <= 0) {
      await deleteStagingFile(stagingKey, auth);
      throw new Error("Empty file.");
    }
    if (meta.size > MAX_PROCESSED_IMAGE_BYTES) {
      await deleteStagingFile(stagingKey, auth);
      throw new Error(
        "Image is too large after upload. Compress under 1 MB and retry.",
      );
    }
    const contentType = meta.contentType?.startsWith("image/")
      ? meta.contentType
      : guessedType;
    if (!contentType.startsWith("image/")) {
      await deleteStagingFile(stagingKey, auth);
      throw new Error("Only image files are allowed.");
    }

    await promoteObject({
      fromKey: stagingKey,
      toKey: finalKey,
      contentType,
      auth,
    });

    const [insertedMedia] = await db
      .insert(medias)
      .values({ alt, key: finalKey })
      .returning({ id: medias.id });

    return {
      mediaId: insertedMedia.id,
      key: finalKey,
      fileName: alt,
      promoted: true as const,
    };
  } catch (promoteError) {
    // Fall back only when promote/HEAD unavailable — keep uploads working.
    const message =
      promoteError instanceof Error ? promoteError.message : String(promoteError);
    const hardFail =
      /empty file|too large|only image|not found|invalid staging/i.test(
        message,
      );
    if (hardFail) throw promoteError;

    logServerError("directUpload/promoteFallback", promoteError);
  }

  let buffer: Buffer;
  try {
    buffer = await getObjectBuffer({
      key: stagingKey,
      maxBytes: MAX_PROCESSED_IMAGE_BYTES,
      auth,
    });
  } catch (error) {
    await deleteStagingFile(stagingKey, auth);
    throw error instanceof Error
      ? error
      : new Error("Uploaded file not found. Try uploading again.");
  }

  if (buffer.length === 0) {
    await deleteStagingFile(stagingKey, auth);
    throw new Error("Empty file.");
  }
  if (buffer.length > MAX_PROCESSED_IMAGE_BYTES) {
    await deleteStagingFile(stagingKey, auth);
    throw new Error(
      "Image is too large after upload. Compress under 1 MB and retry.",
    );
  }

  let processed;
  try {
    processed = await processUploadedImageBuffer(buffer, safeName);
  } catch (error) {
    await deleteStagingFile(stagingKey, auth);
    throw error instanceof Error
      ? error
      : new Error("Image processing failed.");
  }
  buffer = Buffer.alloc(0);

  let uploadedKey: string;
  try {
    uploadedKey = await uploadMediaToR2(
      processed.buffer,
      processed.contentType,
      processed.extension,
      params.purpose === "product-draft"
        ? "product-draft"
        : params.purpose === "velo-product"
          ? "velo-product"
          : "upload",
      { auth },
    );
  } catch (error) {
    await deleteStagingFile(stagingKey, auth);
    throw error instanceof Error ? error : new Error("Storage upload failed.");
  }

  const [insertedMedia] = await db
    .insert(medias)
    .values({ alt, key: uploadedKey })
    .returning({ id: medias.id });

  await deleteStagingFile(stagingKey, auth);

  return {
    mediaId: insertedMedia.id,
    key: uploadedKey,
    fileName: alt,
    promoted: false as const,
  };
}
