import {
  getAllowedAuthCallbackUrls,
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

/** All URLs allowed to receive /auth/callback after OAuth (must match Supabase dashboard). */
export function getAuthCallbackUrls(): string[] {
  const urls = new Set(getAllowedAuthCallbackUrls());
  urls.add(`${getCanonicalSiteOrigin()}/auth/callback`);
  return [...urls];
}
