/**
 * Sri Palani Textiles lockup — single source for asset + display sizes.
 * Intrinsic size must match `public/images/sri-palani-textiles-logo.png`
 * (tight crop; transparent background).
 */
export const BRAND_LOGO = {
  src: "/images/sri-palani-textiles-logo.png",
  width: 464,
  height: 193,
} as const;

/**
 * Fixed display heights (px). Wide lockup (~2.4:1) — set height explicitly
 * so the nav width cannot squeeze the mark.
 */
export const brandLogoMaxHeight = {
  nav: 56,
  md: 72,
  footer: 96,
} as const;

export type BrandLogoSize = keyof typeof brandLogoMaxHeight;
