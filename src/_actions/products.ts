"use server";

import db from "@/lib/supabase/db";
import { productMedias, products } from "@/lib/supabase/schema";
import { requireAdminActionUser } from "@/lib/auth/require-admin";
import { invalidateStorefrontCache } from "@/lib/cache/invalidate-storefront";
import { insertProductWithoutTransaction } from "@/lib/admin/product-insert";
import {
  buildBulkProductInsertValues,
  type NormalizedBulkDraftShared,
} from "@/lib/admin/normalize-bulk-product-shared";
import {
  createProductRecord,
  updateProductRecord,
  type ProductImageOptions,
} from "@/lib/admin/save-product";
import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

function revalidateProductCatalogPaths() {
  // Keep this light on Cloudflare Workers — broad layout revalidation can 1102
  // right after admin saves and surfaces as a vague "Server Components" error.
  try {
    revalidatePath("/admin/products");
    revalidatePath("/shop");
    revalidatePath("/featured");
  } catch (error) {
    console.error("[products] revalidatePath failed:", error);
  }
}

async function softInvalidateStorefrontCache() {
  try {
    await invalidateStorefrontCache();
  } catch (error) {
    console.error("[products] invalidateStorefrontCache failed:", error);
  }
}

export const createProductAction = async (
  product: Parameters<typeof createProductRecord>[0],
  options?: ProductImageOptions,
) => {
  await requireAdminActionUser();
  const created = await createProductRecord(product, options);
  revalidateProductCatalogPaths();
  void softInvalidateStorefrontCache();
  return [created];
};

export const updateProductAction = async (
  productId: string,
  product: Parameters<typeof updateProductRecord>[1],
  options?: ProductImageOptions,
) => {
  await requireAdminActionUser();
  const updated = await updateProductRecord(productId, product, options);
  revalidateProductCatalogPaths();
  void softInvalidateStorefrontCache();
  return [updated];
};

export const getProductsByIds = async (productIds: string[]) => {
  return await db
    .select()
    .from(products)
    .where(inArray(products.id, productIds));
};

type DraftSourceMedia = {
  mediaId: string;
  originalFileName: string;
};

export type BulkDraftSharedData = NormalizedBulkDraftShared;

export type BulkDraftCreateResult = {
  id: string;
  productCode: string;
  name: string;
  slug: string;
};

function getFileNameBase(fileName: string) {
  const cleaned = fileName.replace(/\.[^/.]+$/, "").trim();
  return cleaned || "Product";
}

const DEFAULT_BULK_SHARED: NormalizedBulkDraftShared = {
  baseName: "Product",
  description: "Draft product",
  isDraft: true,
  collectionId: "",
  badge: null,
  rating: "4",
  price: "0",
  stock: 0,
  discountEnabled: false,
  discountPercent: null,
  soldAsPack: false,
  packSize: null,
};

export async function createDraftProductsFromMedia(
  mediaItems: DraftSourceMedia[],
  shared?: BulkDraftSharedData,
): Promise<BulkDraftCreateResult[]> {
  await requireAdminActionUser();
  if (mediaItems.length === 0) return [];

  const normalizedShared = shared ?? DEFAULT_BULK_SHARED;
  if (!String(normalizedShared.collectionId ?? "").trim()) {
    throw new Error("Catalog is required.");
  }

  return (async () => {
    const createdProducts: BulkDraftCreateResult[] = [];

    for (let index = 0; index < mediaItems.length; index += 1) {
      const fileNameBase = getFileNameBase(mediaItems[index].originalFileName);
      const nameBase = (normalizedShared.baseName || fileNameBase).trim();

      const created = await insertProductWithoutTransaction(
        (productCode) => `${nameBase} ${productCode}`,
        (identity) =>
          buildBulkProductInsertValues({
            shared: normalizedShared,
            productName: identity.name,
            slug: identity.slug,
            productCode: identity.productCode,
            featuredImageId: mediaItems[index].mediaId,
          }),
      );

      await db.insert(productMedias).values({
        productId: created.id,
        mediaId: mediaItems[index].mediaId,
        priority: 1,
      });

      createdProducts.push({
        id: created.id,
        name: created.name,
        slug: created.slug,
        productCode: created.productCode ?? "",
      });
    }

    revalidateProductCatalogPaths();
    await invalidateStorefrontCache();
    return createdProducts;
  })();
}
