/**
 * @jest-environment node
 */
import {
  CDN_PRESETS,
  CDN_LARGE_WIDTH,
  CDN_SAFE_WIDTH,
  cdnImageUrl,
  cdnPresetForWidth,
  extractMediaObjectKey,
  getImageDeliveryMode,
} from "./cdn-image";

describe("cdn-image", () => {
  const prevMode = process.env.NEXT_PUBLIC_IMAGE_DELIVERY_MODE;
  const prevCdn = process.env.NEXT_PUBLIC_CDN_URL;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_IMAGE_DELIVERY_MODE = "cloudflare";
    process.env.NEXT_PUBLIC_CDN_URL =
      "https://pub-65f24d69fb304b0b87901be92e533cb1.r2.dev";
  });

  afterAll(() => {
    process.env.NEXT_PUBLIC_IMAGE_DELIVERY_MODE = prevMode;
    process.env.NEXT_PUBLIC_CDN_URL = prevCdn;
  });

  it("defaults to legacy mode until the media worker /cdn route is live", () => {
    delete process.env.NEXT_PUBLIC_IMAGE_DELIVERY_MODE;
    expect(getImageDeliveryMode()).toBe("legacy");
  });

  it("extracts keys from r2.dev URLs and raw keys", () => {
    process.env.NEXT_PUBLIC_IMAGE_DELIVERY_MODE = "cloudflare";
    expect(extractMediaObjectKey("uploads/foo.webp")).toBe("uploads/foo.webp");
    expect(
      extractMediaObjectKey(
        "https://pub-65f24d69fb304b0b87901be92e533cb1.r2.dev/uploads/foo.webp",
      ),
    ).toBe("uploads/foo.webp");
    expect(extractMediaObjectKey("/images/local.svg")).toBeNull();
  });

  it("builds media.sripalanitextiles.com /cdn resize URLs", () => {
    process.env.NEXT_PUBLIC_IMAGE_DELIVERY_MODE = "cloudflare";
    const url = cdnImageUrl("uploads/upload-abc.png", CDN_PRESETS.card);
    expect(url).toBe(
      "https://media.sripalanitextiles.com/cdn/w=480,q=75,f=webp/uploads/upload-abc.png",
    );
  });

  it("snaps large widths to the 1200 preset with fixed quality", () => {
    process.env.NEXT_PUBLIC_IMAGE_DELIVERY_MODE = "cloudflare";
    const url = cdnImageUrl(
      "https://pub-65f24d69fb304b0b87901be92e533cb1.r2.dev/uploads/upload-abc.png",
      { width: 1600, quality: 78, format: "webp" },
    );
    expect(url).toContain(
      `/cdn/w=${CDN_LARGE_WIDTH},q=80,f=webp/uploads/upload-abc.png`,
    );
  });

  it("maps optimizeWidth to the small or large preset", () => {
    expect(cdnPresetForWidth(1200)).toEqual({
      width: CDN_LARGE_WIDTH,
      quality: 80,
      format: "webp",
    });
    expect(cdnPresetForWidth(800)).toEqual({
      width: CDN_LARGE_WIDTH,
      quality: 80,
      format: "webp",
    });
    expect(cdnPresetForWidth(400)).toEqual({
      width: CDN_SAFE_WIDTH,
      quality: 75,
      format: "webp",
    });
    expect(cdnPresetForWidth(112)).toEqual({
      width: CDN_SAFE_WIDTH,
      quality: 75,
      format: "webp",
    });
  });

  it("builds heroMobile LCP URLs at the large width", () => {
    process.env.NEXT_PUBLIC_IMAGE_DELIVERY_MODE = "cloudflare";
    const url = cdnImageUrl("uploads/upload-hero.png", CDN_PRESETS.heroMobile);
    expect(url).toBe(
      `https://media.sripalanitextiles.com/cdn/w=${CDN_LARGE_WIDTH},q=80,f=webp/uploads/upload-hero.png`,
    );
  });

  it("keeps jpeg only when requested", () => {
    process.env.NEXT_PUBLIC_IMAGE_DELIVERY_MODE = "cloudflare";
    expect(
      cdnImageUrl("uploads/a.png", { width: 1200, format: "jpeg" }),
    ).toContain("/cdn/w=1200,q=80,f=jpeg/uploads/a.png");
    expect(
      cdnImageUrl("uploads/a.png", { width: 400, format: "avif" }),
    ).toContain("/cdn/w=480,q=75,f=webp/uploads/a.png");
  });
});
