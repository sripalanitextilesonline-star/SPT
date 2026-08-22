import {
  buildCourierTrackingUrl,
  resolveCourierTrackingUrl,
} from "./courier-tracking-url";

describe("buildCourierTrackingUrl", () => {
  it("returns null when template is missing", () => {
    expect(buildCourierTrackingUrl(null, "T123")).toBeNull();
    expect(buildCourierTrackingUrl("", "T123")).toBeNull();
  });

  it("returns null when tracking number is missing", () => {
    expect(
      buildCourierTrackingUrl("https://track.example.com/{tracking}", null),
    ).toBeNull();
  });

  it("replaces {tracking} token with encoded value", () => {
    expect(
      buildCourierTrackingUrl(
        "https://track.example.com/track?awb={tracking}",
        "ABC/123",
      ),
    ).toBe("https://track.example.com/track?awb=ABC%2F123");
  });

  it("appends tracking as path segment when no token", () => {
    expect(
      buildCourierTrackingUrl("https://track.example.com/awb", "T1234"),
    ).toBe("https://track.example.com/awb/T1234");
  });

  it("rejects non-http protocols", () => {
    expect(buildCourierTrackingUrl("ftp://example.com/{tracking}", "T1")).toBeNull();
  });
});

describe("resolveCourierTrackingUrl", () => {
  it("prefers templateSnapshot over fallback", () => {
    expect(
      resolveCourierTrackingUrl({
        trackingNumber: "AWB123",
        templateSnapshot: "https://primary.com/{tracking}",
        templateFallback: "https://fallback.com/{tracking}",
      }),
    ).toBe("https://primary.com/AWB123");
  });

  it("falls back when snapshot is missing", () => {
    expect(
      resolveCourierTrackingUrl({
        trackingNumber: "AWB123",
        templateSnapshot: null,
        templateFallback: "https://fallback.com/{tracking}",
      }),
    ).toBe("https://fallback.com/AWB123");
  });
});
