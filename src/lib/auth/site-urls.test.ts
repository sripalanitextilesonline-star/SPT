import {
  getAllowedAuthOrigins,
  getAuthCallbackUrls,
  resolveOAuthBrowserOrigin,
} from "./site-urls";

describe("resolveOAuthBrowserOrigin", () => {
  const prev = process.env.NEXT_PUBLIC_SITE_URL;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://sripalanitextiles.com";
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = prev;
  });

  it("keeps www when the shopper opened www (PKCE-safe)", () => {
    expect(resolveOAuthBrowserOrigin("https://www.sripalanitextiles.com")).toBe(
      "https://www.sripalanitextiles.com",
    );
  });

  it("keeps apex when the shopper opened apex", () => {
    expect(resolveOAuthBrowserOrigin("https://sripalanitextiles.com")).toBe(
      "https://sripalanitextiles.com",
    );
  });

  it("falls back to canonical for unknown hosts", () => {
    expect(resolveOAuthBrowserOrigin("https://evil.example")).toBe(
      "https://sripalanitextiles.com",
    );
  });
});

describe("getAuthCallbackUrls", () => {
  it("includes apex and www callbacks", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://sripalanitextiles.com";
    const urls = getAuthCallbackUrls();
    expect(urls).toEqual(
      expect.arrayContaining([
        "https://sripalanitextiles.com/auth/callback",
        "https://www.sripalanitextiles.com/auth/callback",
      ]),
    );
    expect(getAllowedAuthOrigins()).toEqual(
      expect.arrayContaining([
        "https://sripalanitextiles.com",
        "https://www.sripalanitextiles.com",
      ]),
    );
  });
});
