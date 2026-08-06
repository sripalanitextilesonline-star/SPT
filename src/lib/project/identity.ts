import identity from "../../../project.identity.json";

type ProjectIdentity = typeof identity;

export const projectIdentity: ProjectIdentity = identity;

export function normalizeOrigin(value: string): string {
  return value.trim().replace(/\/$/, "");
}

export function getCanonicalSiteOrigin(): string {
  return normalizeOrigin(projectIdentity.site.canonicalUrl);
}

export function getAllowedAuthOrigins(): string[] {
  return projectIdentity.site.authRedirectOrigins.map(normalizeOrigin);
}

export function getAllowedAuthCallbackUrls(): string[] {
  return getAllowedAuthOrigins().map((origin) => `${origin}/auth/callback`);
}

export function isKnownProductionOrigin(origin: string): boolean {
  return projectIdentity.site.productionOrigins
    .map(normalizeOrigin)
    .includes(normalizeOrigin(origin));
}
