import { env } from "@/env.mjs";

export type ImageDeliveryMode = "cloudflare" | "legacy";

export type CdnImageOptions = {
  /** Target display width in CSS pixels (served via CF Images). */
  width: number;
  quality?: number;
  format?: "webp" | "avif" | "jpeg";
};

/**
 * Images Free allows 5k unique transforms/month. Every request snaps to one
 * of two widths with fixed quality (mirrored in the media worker) so each
 * image costs at most a few variants.
 */
export const CDN_SAFE_WIDTH = 480;
export const CDN_SAFE_QUALITY = 75;
export const CDN_SAFE_FORMAT = "webp" as const;
export const CDN_LARGE_WIDTH = 1200;
export const CDN_LARGE_QUALITY = 80;

const SMALL_PRESET = {
  width: CDN_SAFE_WIDTH,
  quality: CDN_SAFE_QUALITY,
  format: CDN_SAFE_FORMAT,
} as const;

const LARGE_PRESET = {
  width: CDN_LARGE_WIDTH,
  quality: CDN_LARGE_QUALITY,
  format: CDN_SAFE_FORMAT,
} as const;

export const CDN_PRESETS = {
  thumb: { ...SMALL_PRESET },
  card: { ...SMALL_PRESET },
  pdp: { ...LARGE_PRESET },
  heroMobile: { ...LARGE_PRESET },
  hero: { ...LARGE_PRESET },
} as const;

/** Pick the snapped CDN preset for an optimizeWidth (matches preload URLs). */
export function cdnPresetForWidth(width: number): CdnImageOptions {
  return width <= CDN_SAFE_WIDTH ? { ...SMALL_PRESET } : { ...LARGE_PRESET };
}

const DEFAULT_MEDIA_ORIGIN = "https://media.sripalanitextiles.com";
const FALLBACK = "/images/sri-palani-textiles-logo.png";

export function getImageDeliveryMode(): ImageDeliveryMode {
  // Raw R2 URLs unless NEXT_PUBLIC_IMAGE_DELIVERY_MODE=cloudflare and the
  // media worker /cdn route is deployed.
  const raw = String(process.env.NEXT_PUBLIC_IMAGE_DELIVERY_MODE ?? "legacy")
    .trim()
    .toLowerCase();
  return raw === "legacy" ? "legacy" : "cloudflare";
}

function mediaOrigin(): string {
  const fromEnv = String(
    process.env.NEXT_PUBLIC_MEDIA_CDN_ORIGIN ?? DEFAULT_MEDIA_ORIGIN,
  )
    .trim()
    .replace(/\/$/, "");
  return fromEnv || DEFAULT_MEDIA_ORIGIN;
}

function cdnPublicBase(): string | null {
  const fromProcess = process.env.NEXT_PUBLIC_CDN_URL?.replace(/\/$/, "");
  if (fromProcess) return fromProcess;
  try {
    return env.NEXT_PUBLIC_CDN_URL.replace(/\/$/, "");
  } catch {
    return null;
  }
}

/**
 * Extract an R2 object key from a storefront media URL or raw key.
 * Returns null for local assets / unknown hosts (leave as-is).
 */
export function extractMediaObjectKey(keyOrUrl: string): string | null {
  const raw = keyOrUrl.trim();
  if (!raw || raw === FALLBACK) return null;
  if (raw.startsWith("/")) return null;

  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    try {
      const url = new URL(raw);
      if (url.origin === mediaOrigin()) {
        const m = url.pathname.match(/^\/cdn\/[^/]+\/(.+)$/);
        return m?.[1] ? decodeURIComponent(m[1]) : null;
      }
      const base = cdnPublicBase();
      if (base) {
        const baseUrl = new URL(base);
        if (url.hostname === baseUrl.hostname) {
          return decodeURIComponent(url.pathname.replace(/^\//, ""));
        }
      }
      if (url.hostname.endsWith(".r2.dev")) {
        return decodeURIComponent(url.pathname.replace(/^\//, ""));
      }
      return null;
    } catch {
      return null;
    }
  }

  if (raw.includes("..") || raw.startsWith("sakthi/")) return null;
  return raw.replace(/^\//, "");
}

/**
 * Build a Cloudflare Images resize URL on the media CDN origin.
 * Falls back to the original key/URL when mode is legacy or key is not CDN media.
 */
export function cdnImageUrl(
  keyOrUrl: string | null | undefined,
  options: CdnImageOptions,
): string {
  if (!keyOrUrl?.trim()) return FALLBACK;
  const input = keyOrUrl.trim();
  if (getImageDeliveryMode() === "legacy") return input;

  const key = extractMediaObjectKey(input);
  if (!key || !key.startsWith("uploads/")) {
    return input.startsWith("http") || input.startsWith("/") ? input : FALLBACK;
  }

  const small = options.width <= CDN_SAFE_WIDTH;
  const width = small ? CDN_SAFE_WIDTH : CDN_LARGE_WIDTH;
  const quality = small ? CDN_SAFE_QUALITY : CDN_LARGE_QUALITY;
  const format = options.format === "jpeg" ? "jpeg" : CDN_SAFE_FORMAT;
  const opts = `w=${width},q=${quality},f=${format}`;
  return `${mediaOrigin()}/cdn/${opts}/${key}`;
}
