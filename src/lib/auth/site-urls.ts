import {
  getAllowedAuthOrigins as getIdentityAllowedAuthOrigins,
  getCanonicalSiteOrigin as getIdentityCanonicalSiteOrigin,
  normalizeOrigin,
} from "@/lib/project/identity";

/** Primary site origin from env when set; otherwise project identity (Cloudflare canonical). */
export function getCanonicalSiteOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) {
    return normalizeOrigin(fromEnv);
  }

  return getIdentityCanonicalSiteOrigin();
}

/** Site base URL with trailing slash (for return/notify URL builders). */
export function getCanonicalSiteBaseUrl(): string {
  const origin = getCanonicalSiteOrigin();
  return origin.endsWith("/") ? origin : `${origin}/`;
}

/** Origins allowed for OAuth start + /auth/callback (must match Supabase allow list). */
export function getAllowedAuthOrigins(): string[] {
  const canonical = getCanonicalSiteOrigin();
  const origins = new Set<string>([
    canonical,
    ...getIdentityAllowedAuthOrigins(),
  ]);

  try {
    const host = new URL(canonical).host;
    if (host.startsWith("www.")) {
      origins.add(`https://${host.replace(/^www\./, "")}`);
    } else if (!host.startsWith("localhost") && !host.startsWith("127.")) {
      origins.add(`https://www.${host}`);
    }
  } catch {
    /* ignore invalid canonical URL */
  }

  return [...origins];
}

/** All URLs allowed to receive /auth/callback after OAuth (must match Supabase dashboard). */
export function getAuthCallbackUrls(): string[] {
  return getAllowedAuthOrigins().map((origin) => `${origin}/auth/callback`);
}

/**
 * Browser origin for OAuth `redirectTo`. Must match the page the user is on,
 * or Supabase PKCE cookies (host-only) fail after Google returns
 * (classic www vs apex break).
 */
export function resolveOAuthBrowserOrigin(
  currentOrigin?: string | null,
): string {
  const canonical = getCanonicalSiteOrigin();
  const raw = String(currentOrigin ?? "")
    .trim()
    .replace(/\/$/, "");
  if (!raw) return canonical;

  const allowed = new Set(getAllowedAuthOrigins().map((o) => o.toLowerCase()));
  if (allowed.has(raw.toLowerCase())) return raw;
  return canonical;
}
