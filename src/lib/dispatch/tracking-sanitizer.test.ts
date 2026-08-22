import { sanitizeTrackingNumber } from "./tracking-sanitizer";

describe("sanitizeTrackingNumber", () => {
  it("returns null for null/undefined/empty", () => {
    expect(sanitizeTrackingNumber(null)).toBeNull();
    expect(sanitizeTrackingNumber(undefined)).toBeNull();
    expect(sanitizeTrackingNumber("")).toBeNull();
    expect(sanitizeTrackingNumber("   ")).toBeNull();
  });

  it("normalizes and uppercases", () => {
    expect(sanitizeTrackingNumber(" abc-123 ")).toBe("ABC-123");
    expect(sanitizeTrackingNumber("sr/123_456")).toBe("SR/123_456");
  });

  it("strips internal spaces", () => {
    expect(sanitizeTrackingNumber("AB 12 CD")).toBe("AB12CD");
  });

  it("throws on invalid characters", () => {
    expect(() => sanitizeTrackingNumber("abc!")).toThrow(/Allowed characters/);
    expect(() => sanitizeTrackingNumber("abc@xyz")).toThrow(
      /Allowed characters/,
    );
  });

  it("throws on too-long tracking numbers", () => {
    const long = "A".repeat(65);
    expect(() => sanitizeTrackingNumber(long)).toThrow(/too long/);
  });
});
