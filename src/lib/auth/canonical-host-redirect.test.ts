import { buildCanonicalRedirectUrl } from "./canonical-host-redirect";

const CANONICAL = "https://example.com";

describe("buildCanonicalRedirectUrl", () => {
  it("redirects workers.dev to the custom domain", () => {
    expect(
      buildCanonicalRedirectUrl(
        "https://sri-palani-textiles.workers.dev/shop",
        "sri-palani-textiles.workers.dev",
        CANONICAL,
      ),
    ).toBe("https://example.com/shop");
  });

  it("preserves query strings through redirect", () => {
    expect(
      buildCanonicalRedirectUrl(
        "https://sri-palani-textiles.workers.dev/?code=abc123",
        "sri-palani-textiles.workers.dev",
        CANONICAL,
      ),
    ).toBe("https://example.com/?code=abc123");
  });

  it("does not redirect the canonical apex host", () => {
    expect(
      buildCanonicalRedirectUrl(
        "https://example.com/shop",
        "example.com",
        CANONICAL,
      ),
    ).toBeNull();
  });

  it("does not redirect the canonical www host", () => {
    expect(
      buildCanonicalRedirectUrl(
        "https://www.example.com/shop",
        "www.example.com",
        CANONICAL,
      ),
    ).toBeNull();
  });

  it("does not redirect localhost", () => {
    expect(
      buildCanonicalRedirectUrl(
        "http://localhost:3000/shop",
        "localhost",
        CANONICAL,
      ),
    ).toBeNull();
  });

  it("does not redirect when canonical is still workers.dev", () => {
    expect(
      buildCanonicalRedirectUrl(
        "https://sri-palani-textiles.workers.dev/",
        "sri-palani-textiles.workers.dev",
        "https://sri-palani-textiles.workers.dev",
      ),
    ).toBeNull();
  });
});
