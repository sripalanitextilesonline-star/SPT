import { loadMediaUsageForDelete } from "@/lib/admin/media-library";
import {
  addDays,
  mediaPurgeAtIso,
  UNPAID_ORDER_RETENTION_DAYS,
} from "@/lib/admin/product-lifecycle-policy";
import { classifyProductDeleteTargets } from "@/lib/admin/product-lifecycle-classify";
import { isMediaSafeToPurge } from "@/lib/admin/product-lifecycle-media";
import { deleteMediaStorageKeys } from "@/lib/storage/deleteMediaFiles";
import db from "@/lib/supabase/db";
import {
  collections,
  medias,
  orderLines,
  orders,
  productMedias,
  products,
} from "@/lib/supabase/schema";
import { and, eq, inArray, isNotNull, lte, sql } from "drizzle-orm";

export type ProductLifecycleOutcome = {
  deletedIds: string[];
  archivedIds: string[];
  /** Idempotent DELETE: ids that were already absent from the catalog. */
  alreadyGoneIds: string[];
  blocked: { id: string; reason: string }[];
};

export { classifyProductDeleteTargets } from "@/lib/admin/product-lifecycle-classify";

export async function getProductIdsWithPaidOrders(
  productIds: string[],
): Promise<Set<string>> {
  if (productIds.length === 0) return new Set();

  const rows = await db
    .selectDistinct({ productId: orderLines.productId })
    .from(orderLines)
    .innerJoin(orders, eq(orderLines.orderId, orders.id))
    .where(
      and(
        inArray(orderLines.productId, productIds),
        eq(orders.payment_status, "paid"),
      ),
    );

  return new Set(
    rows.map((row) => row.productId).filter((id): id is string => Boolean(id)),
  );
}

export async function backfillOrderLineSnapshotsForProduct(productId: string) {
  await db.execute(sql`
    UPDATE order_lines ol
    SET
      product_name_snapshot = COALESCE(ol.product_name_snapshot, src.name),
      product_slug_snapshot = COALESCE(ol.product_slug_snapshot, src.slug),
      product_code_snapshot = COALESCE(ol.product_code_snapshot, src.product_code),
      product_image_key_snapshot = COALESCE(ol.product_image_key_snapshot, src.image_key)
    FROM (
      SELECT
        ol2.id AS order_line_id,
        p.name,
        p.slug,
        p.product_code,
        m.key AS image_key
      FROM order_lines ol2
      INNER JOIN products p ON p.id = ol2.product_id
      LEFT JOIN medias m ON m.id = p.featured_image_id
      WHERE ol2.product_id = ${productId}
    ) src
    WHERE ol.id = src.order_line_id
  `);
}

async function collectProductMediaIds(productId: string): Promise<string[]> {
  const product = await db.query.products.findFirst({
    where: eq(products.id, productId),
    columns: { featuredImageId: true },
  });
  if (!product) return [];

  const galleryRows = await db
    .select({ mediaId: productMedias.mediaId })
    .from(productMedias)
    .where(eq(productMedias.productId, productId));

  const ids = new Set<string>();
  if (product.featuredImageId) ids.add(product.featuredImageId);
  for (const row of galleryRows) ids.add(row.mediaId);
  return [...ids];
}

/** Max orphan media rows cleaned per lifecycle cron run. */
export const ORPHAN_MEDIA_PURGE_LIMIT = 40;

/**
 * Delete medias that are unused by products/collections/testimonials/banners.
 * Safe after product rows are already gone (DB-first deletes).
 */
export async function deleteUnusedMedias(mediaIds: string[]) {
  const uniqueIds = [
    ...new Set(mediaIds.map((id) => id.trim()).filter(Boolean)),
  ];
  if (uniqueIds.length === 0) return { deletedMedia: 0 };

  const { usageByMedia } = await loadMediaUsageForDelete(uniqueIds);
  const keysToDelete: string[] = [];
  const mediaIdsToDelete: string[] = [];

  for (const mediaId of uniqueIds) {
    const usage = usageByMedia.get(mediaId);
    if (!isMediaSafeToPurge(usage)) continue;

    const mediaRow = await db.query.medias.findFirst({
      where: eq(medias.id, mediaId),
      columns: { key: true },
    });
    if (mediaRow?.key) keysToDelete.push(mediaRow.key);
    mediaIdsToDelete.push(mediaId);
  }

  await deleteMediaStorageKeys(keysToDelete);
  if (mediaIdsToDelete.length > 0) {
    await db.delete(medias).where(inArray(medias.id, mediaIdsToDelete));
  }
  return { deletedMedia: mediaIdsToDelete.length };
}

async function deleteExclusiveProductMedias(
  mediaIds: string[],
  productId: string,
) {
  if (mediaIds.length === 0) return;

  const { usageByMedia } = await loadMediaUsageForDelete(mediaIds);
  const keysToDelete: string[] = [];
  const mediaIdsToDelete: string[] = [];

  for (const mediaId of mediaIds) {
    const usage = usageByMedia.get(mediaId);
    const remainingProductIds = usage?.productIds ?? [];
    // After the product row is gone, zero remaining product refs means this
    // media was exclusive to it (or already unused).
    const unusedByProducts =
      remainingProductIds.length === 0 ||
      (remainingProductIds.length === 1 &&
        remainingProductIds[0] === productId);

    if (!unusedByProducts) continue;
    if ((usage?.collectionCount ?? 0) > 0) continue;
    if ((usage?.testimonialCount ?? 0) > 0) continue;
    if ((usage?.bannerSlideCount ?? 0) > 0) continue;

    const mediaRow = await db.query.medias.findFirst({
      where: eq(medias.id, mediaId),
      columns: { key: true },
    });
    if (mediaRow?.key) keysToDelete.push(mediaRow.key);
    mediaIdsToDelete.push(mediaId);
  }

  await deleteMediaStorageKeys(keysToDelete);
  if (mediaIdsToDelete.length > 0) {
    await db.delete(medias).where(inArray(medias.id, mediaIdsToDelete));
  }
}

/**
 * Hard-delete products from the catalog (DB first).
 * Photo/R2 cleanup is best-effort and non-blocking; cron purgeOrphanMedias
 * is the durable safety net so seller delete stays fast.
 */
export async function deleteProductsCompletely(productIds: string[]) {
  const uniqueIds = [...new Set(productIds)];
  if (uniqueIds.length === 0) return;

  const mediaIds = new Set<string>();
  await Promise.all(
    uniqueIds.map(async (productId) => {
      for (const id of await collectProductMediaIds(productId)) {
        mediaIds.add(id);
      }
    }),
  );

  await db.delete(products).where(inArray(products.id, uniqueIds));

  if (mediaIds.size > 0) {
    const ids = [...mediaIds];
    void deleteUnusedMedias(ids).catch((error) => {
      console.error(
        "[lifecycle] best-effort media cleanup after product delete failed:",
        error,
      );
    });
  }
}

export async function archiveProductsWithPaidHistory(
  productIds: string[],
  options?: { clearCollection?: boolean },
) {
  const nowIso = new Date().toISOString();
  const purgeAtIso = mediaPurgeAtIso();

  for (const productId of productIds) {
    await backfillOrderLineSnapshotsForProduct(productId);
  }

  await db
    .update(products)
    .set({
      isDraft: true,
      featured: false,
      archivedAt: nowIso,
      mediaPurgeAt: purgeAtIso,
      ...(options?.clearCollection ? { collectionId: null } : {}),
    })
    .where(inArray(products.id, productIds));
}

export async function deleteOrArchiveProducts(
  productIds: string[],
  options?: { clearCollection?: boolean },
): Promise<ProductLifecycleOutcome> {
  const uniqueIds = [...new Set(productIds)];
  const existingRows =
    uniqueIds.length > 0
      ? await db
          .select({ id: products.id })
          .from(products)
          .where(inArray(products.id, uniqueIds))
      : [];
  const existingIds = new Set(existingRows.map((row) => row.id));
  const paidLinked = await getProductIdsWithPaidOrders(uniqueIds);
  const { toDelete, toArchive, alreadyGoneIds } = classifyProductDeleteTargets(
    uniqueIds,
    existingIds,
    paidLinked,
  );

  const deletedIds: string[] = [];
  const archivedIds: string[] = [];

  if (toDelete.length > 0) {
    await deleteProductsCompletely(toDelete);
    deletedIds.push(...toDelete);
  }

  if (toArchive.length > 0) {
    await archiveProductsWithPaidHistory(toArchive, options);
    archivedIds.push(...toArchive);
  }

  // DELETE is idempotent: missing ids succeed as alreadyGone, never as blocked.
  return { deletedIds, archivedIds, alreadyGoneIds, blocked: [] };
}

export async function deleteCategoryWithProducts(collectionId: string) {
  const [collection] = await db
    .select({ id: collections.id })
    .from(collections)
    .where(eq(collections.id, collectionId))
    .limit(1);

  if (!collection) {
    return null;
  }

  const productRows = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.collectionId, collectionId));

  const productOutcome = await deleteOrArchiveProducts(
    productRows.map((row) => row.id),
    { clearCollection: true },
  );

  await db.delete(collections).where(eq(collections.id, collectionId));

  return productOutcome;
}

/** Products processed per category-delete request (keeps each call under serverless limits). */
export const CATEGORY_DELETE_BATCH_SIZE = 10;

/**
 * Delete/archive a batch of products in a category, then remove the category
 * when none remain. Designed for client-driven progress loops.
 */
export async function deleteCategoryProductsBatch(
  collectionId: string,
  batchSize = CATEGORY_DELETE_BATCH_SIZE,
): Promise<{
  deletedIds: string[];
  archivedIds: string[];
  alreadyGoneIds: string[];
  blocked: { id: string; reason: string }[];
  remaining: number;
  done: boolean;
  collectionDeleted: boolean;
} | null> {
  const [collection] = await db
    .select({ id: collections.id })
    .from(collections)
    .where(eq(collections.id, collectionId))
    .limit(1);

  if (!collection) {
    return null;
  }

  const [{ productCount }] = await db
    .select({ productCount: sql<number>`count(*)::int` })
    .from(products)
    .where(eq(products.collectionId, collectionId));

  const totalProducts = Number(productCount ?? 0);

  if (totalProducts === 0) {
    const [collectionMedia] = await db
      .select({ featuredImageId: collections.featuredImageId })
      .from(collections)
      .where(eq(collections.id, collectionId))
      .limit(1);
    await db.delete(collections).where(eq(collections.id, collectionId));
    const featuredId = collectionMedia?.featuredImageId;
    if (featuredId) {
      void deleteUnusedMedias([featuredId]).catch((error) => {
        console.error(
          "[lifecycle] best-effort category media cleanup failed:",
          error,
        );
      });
    }
    return {
      deletedIds: [],
      archivedIds: [],
      alreadyGoneIds: [],
      blocked: [],
      remaining: 0,
      done: true,
      collectionDeleted: true,
    };
  }

  const productRows = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.collectionId, collectionId))
    .limit(Math.max(1, batchSize));

  const batchIds = productRows.map((row) => row.id);

  const productOutcome = await deleteOrArchiveProducts(batchIds, {
    clearCollection: true,
  });

  const [{ remaining }] = await db
    .select({ remaining: sql<number>`count(*)::int` })
    .from(products)
    .where(eq(products.collectionId, collectionId));

  const remainingCount = Number(remaining ?? 0);
  let collectionDeleted = false;

  if (remainingCount === 0) {
    const [collectionMedia] = await db
      .select({ featuredImageId: collections.featuredImageId })
      .from(collections)
      .where(eq(collections.id, collectionId))
      .limit(1);
    await db.delete(collections).where(eq(collections.id, collectionId));
    collectionDeleted = true;
    const featuredId = collectionMedia?.featuredImageId;
    if (featuredId) {
      void deleteUnusedMedias([featuredId]).catch((error) => {
        console.error(
          "[lifecycle] best-effort category media cleanup failed:",
          error,
        );
      });
    }
  }

  return {
    ...productOutcome,
    remaining: remainingCount,
    done: collectionDeleted,
    collectionDeleted,
  };
}

/**
 * Durable cleanup for medias left behind by DB-first product/category deletes.
 * Skips anything still referenced by products, collections, testimonials, or banners.
 */
export async function purgeOrphanMedias(
  limit = ORPHAN_MEDIA_PURGE_LIMIT,
): Promise<{ purgedOrphanMedia: number }> {
  const max = Math.max(1, Math.min(100, limit));

  // Candidate query: no FK refs in core tables. Banner JSON usage is re-checked
  // inside deleteUnusedMedias via loadMediaUsageForDelete.
  const candidates = await db
    .select({ id: medias.id })
    .from(medias)
    .where(
      sql`
        NOT EXISTS (SELECT 1 FROM products p WHERE p.featured_image_id = ${medias.id})
        AND NOT EXISTS (SELECT 1 FROM product_medias pm WHERE pm.media_id = ${medias.id})
        AND NOT EXISTS (SELECT 1 FROM collections c WHERE c.featured_image_id = ${medias.id})
        AND NOT EXISTS (SELECT 1 FROM testimonials t WHERE t.featured_image_id = ${medias.id})
      `,
    )
    .orderBy(medias.id)
    .limit(max);

  const ids = candidates.map((row) => row.id).filter(Boolean);
  if (ids.length === 0) {
    return { purgedOrphanMedia: 0 };
  }

  const result = await deleteUnusedMedias(ids);
  return { purgedOrphanMedia: result.deletedMedia };
}

export async function purgeArchivedProductMedia() {
  const nowIso = new Date().toISOString();
  const dueProducts = await db
    .select({ id: products.id })
    .from(products)
    .where(
      and(
        isNotNull(products.archivedAt),
        isNotNull(products.mediaPurgeAt),
        lte(products.mediaPurgeAt, nowIso),
      ),
    );

  for (const { id } of dueProducts) {
    await backfillOrderLineSnapshotsForProduct(id);
    const mediaIds = await collectProductMediaIds(id);
    await db.delete(products).where(eq(products.id, id));
    // Archive purge can await — cron path, not seller request path.
    await deleteExclusiveProductMedias(mediaIds, id);
  }

  return { purgedProducts: dueProducts.length };
}

export async function deleteStaleUnpaidOrders() {
  const cutoff = addDays(new Date(), -UNPAID_ORDER_RETENTION_DAYS);

  const staleOrders = await db
    .select({ id: orders.id })
    .from(orders)
    .where(
      and(eq(orders.payment_status, "unpaid"), lte(orders.createdAt, cutoff)),
    );

  const orderIds = staleOrders.map((row) => row.id);
  if (orderIds.length === 0) {
    return { deletedOrders: 0 };
  }

  await db.delete(orderLines).where(inArray(orderLines.orderId, orderIds));
  await db.delete(orders).where(inArray(orders.id, orderIds));

  return { deletedOrders: orderIds.length };
}

export async function runLifecycleCleanup() {
  const unpaid = await deleteStaleUnpaidOrders();
  const archive = await purgeArchivedProductMedia();
  const orphans = await purgeOrphanMedias();
  return { ...unpaid, ...archive, ...orphans };
}
