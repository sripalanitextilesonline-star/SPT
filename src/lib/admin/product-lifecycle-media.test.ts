import { isMediaSafeToPurge } from "./product-lifecycle-media";

describe("isMediaSafeToPurge", () => {
  it("allows purge when nothing references the media", () => {
    expect(
      isMediaSafeToPurge({
        productIds: [],
        productCount: 0,
        collectionCount: 0,
        testimonialCount: 0,
        bannerSlideCount: 0,
      }),
    ).toBe(true);
  });

  it("blocks purge when another product still uses it", () => {
    expect(
      isMediaSafeToPurge({
        productIds: ["p1"],
        productCount: 1,
        collectionCount: 0,
        testimonialCount: 0,
        bannerSlideCount: 0,
      }),
    ).toBe(false);
  });

  it("blocks purge when a collection still uses it", () => {
    expect(
      isMediaSafeToPurge({
        productIds: [],
        productCount: 0,
        collectionCount: 1,
        testimonialCount: 0,
        bannerSlideCount: 0,
      }),
    ).toBe(false);
  });

  it("blocks purge when a banner slide still uses it", () => {
    expect(
      isMediaSafeToPurge({
        productIds: [],
        productCount: 0,
        collectionCount: 0,
        testimonialCount: 0,
        bannerSlideCount: 1,
      }),
    ).toBe(false);
  });
});
