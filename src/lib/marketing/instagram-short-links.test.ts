import {
  buildInstagramShortLinkTarget,
  normalizeInstagramShortCode,
} from "./instagram-short-links";

const ORIGIN = "https://sripalanitextiles.com";

describe("instagram short links", () => {
  it("maps known codes to pages with UTM tags", () => {
    const url = buildInstagramShortLinkTarget("new", ORIGIN);
    expect(url.origin).toBe(ORIGIN);
    expect(url.pathname).toBe("/featured");
    expect(url.searchParams.get("utm_source")).toBe("instagram");
    expect(url.searchParams.get("utm_medium")).toBe("dm");
    expect(url.searchParams.get("utm_campaign")).toBe("new");
  });

  it("is case/whitespace tolerant", () => {
    expect(buildInstagramShortLinkTarget(" Shop ", ORIGIN).pathname).toBe(
      "/shop",
    );
  });

  it("falls back to /collections/<slug> for unknown slugs", () => {
    const url = buildInstagramShortLinkTarget("silk-sarees", ORIGIN);
    expect(url.pathname).toBe("/collections/silk-sarees");
    expect(url.searchParams.get("utm_campaign")).toBe("silk-sarees");
  });

  it("rejects unsafe codes and sends them to /shop", () => {
    expect(normalizeInstagramShortCode("../admin")).toBeNull();
    expect(normalizeInstagramShortCode("a b")).toBeNull();
    const url = buildInstagramShortLinkTarget("//evil.com", ORIGIN);
    expect(url.origin).toBe(ORIGIN);
    expect(url.pathname).toBe("/shop");
    expect(url.searchParams.get("utm_campaign")).toBe("unknown");
  });

  it("never redirects off-origin", () => {
    const url = buildInstagramShortLinkTarget("https:evil.com", ORIGIN);
    expect(url.origin).toBe(ORIGIN);
  });
});
