/** Pure exclusivity rules for DB-first media purge (cron + best-effort). */

export type MediaUsageCounts = {
  productIds?: string[];
  productCount?: number;
  collectionCount?: number;
  testimonialCount?: number;
  bannerSlideCount?: number;
};

export function isMediaSafeToPurge(usage: MediaUsageCounts | undefined): boolean {
  if (!usage) return true;
  if ((usage.productIds?.length ?? 0) > 0) return false;
  if ((usage.productCount ?? 0) > 0) return false;
  if ((usage.collectionCount ?? 0) > 0) return false;
  if ((usage.testimonialCount ?? 0) > 0) return false;
  if ((usage.bannerSlideCount ?? 0) > 0) return false;
  return true;
}
