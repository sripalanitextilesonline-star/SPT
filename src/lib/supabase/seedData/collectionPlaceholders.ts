import { BRAND_LOGO } from "@/lib/brand/logo";

const CDN = "https://pub-65f24d69fb304b0b87901be92e533cb1.r2.dev";

/** Sample saree photos on R2 (fallback when a collection has no media). */
export const SAREE_SHOP_MODEL_IMAGES = [
  `${CDN}/public/silk-sarees.jpg`,
  `${CDN}/public/cotton-sarees.jpg`,
  `${CDN}/public/kanchi-sarees.jpg`,
  `${CDN}/public/designer-sarees.jpg`,
  `${CDN}/uploads/sample-kanchi-maroon.jpg`,
  `${CDN}/uploads/sample-silk-gold.jpg`,
  `${CDN}/uploads/sample-cotton-cream.jpg`,
  `${CDN}/uploads/sample-georgette-navy.jpg`,
] as const;

export const SAKTHI_MEDIA_BASE = "/images/";

/** Best-fit image per category label */
const COLLECTION_IMAGE_BY_LABEL: Record<string, string> = {
  "Softie Sarees": SAREE_SHOP_MODEL_IMAGES[3],
  "Kanjivaram Wedding Sarees": SAREE_SHOP_MODEL_IMAGES[0],
  "Soft Silk Sarees": SAREE_SHOP_MODEL_IMAGES[0],
  "Banaras Tissue Silk Sarees": SAREE_SHOP_MODEL_IMAGES[5],
  "Traditional Silk Sarees": SAREE_SHOP_MODEL_IMAGES[0],
  "Kubera Pattu Sarees": SAREE_SHOP_MODEL_IMAGES[2],
  "Wedding Collections": SAREE_SHOP_MODEL_IMAGES[2],
  "Cotton Sarees": SAREE_SHOP_MODEL_IMAGES[1],
  "Silk Cotton Sarees": SAREE_SHOP_MODEL_IMAGES[1],
  "Fancy Silk Sarees": SAREE_SHOP_MODEL_IMAGES[3],
  "Mysore Silk": SAREE_SHOP_MODEL_IMAGES[5],
  "Space Silk Saree": SAREE_SHOP_MODEL_IMAGES[0],
  "Fancy Sarees": SAREE_SHOP_MODEL_IMAGES[3],
  "Celebrity Inspired Saree": SAREE_SHOP_MODEL_IMAGES[7],
  "Silk Sarees": SAREE_SHOP_MODEL_IMAGES[0],
  "Kanchi Sarees": SAREE_SHOP_MODEL_IMAGES[2],
  "Designer Sarees": SAREE_SHOP_MODEL_IMAGES[3],
  "Premium Silk Sarees": SAREE_SHOP_MODEL_IMAGES[0],
};

export const COLLECTION_PLACEHOLDER_IMAGES = [...SAREE_SHOP_MODEL_IMAGES];

export function collectionPlaceholderImage(index: number): string {
  const list = COLLECTION_PLACEHOLDER_IMAGES;
  return list[index % list.length] ?? list[0];
}

/** Category-aware image — replace with real product photography */
export function collectionImageForLabel(label: string, index = 0): string {
  return COLLECTION_IMAGE_BY_LABEL[label] ?? collectionPlaceholderImage(index);
}

export const DEFAULT_SAREE_PLACEHOLDER = BRAND_LOGO.src;

/** Default hero banner images */
export const HERO_BANNER_IMAGES = {
  festiveSilk: SAREE_SHOP_MODEL_IMAGES[0],
  softCotton: SAREE_SHOP_MODEL_IMAGES[1],
  wedding: SAREE_SHOP_MODEL_IMAGES[2],
  traditional: SAREE_SHOP_MODEL_IMAGES[3],
} as const;
