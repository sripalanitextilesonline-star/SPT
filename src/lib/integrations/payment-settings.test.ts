import {
  CASHFREE_PRODUCTION_BASE_URL,
  CASHFREE_SANDBOX_BASE_URL,
  normalizeCashfreeIncoming,
  normalizePhonePeIncoming,
  parseEnabledPhonePeValue,
  parseIncomingPhonePeForEnable,
  resolveCashfreeBaseUrl,
  resolvePhonePeEnvironment,
} from "./payment-settings";

describe("payment-settings", () => {
  it("maps production environment to the live Cashfree base URL", () => {
    expect(
      resolveCashfreeBaseUrl({
        environment: "production",
        baseUrl: CASHFREE_SANDBOX_BASE_URL,
      }),
    ).toBe(CASHFREE_PRODUCTION_BASE_URL);
  });

  it("maps sandbox environment to the sandbox Cashfree base URL", () => {
    expect(
      resolveCashfreeBaseUrl({
        environment: "sandbox",
        baseUrl: CASHFREE_PRODUCTION_BASE_URL,
      }),
    ).toBe(CASHFREE_SANDBOX_BASE_URL);
  });

  it("normalizes mismatched Cashfree environment and base URL on save", () => {
    const normalized = normalizeCashfreeIncoming({
      clientId: "cf-id",
      clientSecret: "cf-secret",
      baseUrl: CASHFREE_SANDBOX_BASE_URL,
      environment: "production",
      apiVersion: "2026-01-01",
    });

    expect(normalized.baseUrl).toBe(CASHFREE_PRODUCTION_BASE_URL);
    expect(normalized.environment).toBe("production");
    expect(normalized.apiVersion).toBe("2026-01-01");
  });

  it("defaults Cashfree API version to 2026-01-01 when omitted", () => {
    const normalized = normalizeCashfreeIncoming({
      clientId: "cf-id",
      clientSecret: "cf-secret",
      environment: "sandbox",
    });

    expect(normalized.apiVersion).toBe("2026-01-01");
  });

  it("allows saving disabled PhonePe without OAuth credentials", () => {
    const normalized = normalizePhonePeIncoming({
      clientId: "",
      clientSecret: "",
      clientVersion: "",
    });

    expect(normalized.clientId).toBe("");
    expect(parseEnabledPhonePeValue(normalized).success).toBe(false);
  });

  it("maps legacy merchantId/saltKey/saltIndex to OAuth fields", () => {
    const normalized = normalizePhonePeIncoming({
      merchantId: "PGTEST",
      saltIndex: "1",
      saltKey: "secret",
    });

    expect(normalized.clientId).toBe("PGTEST");
    expect(normalized.clientVersion).toBe("1");
    expect(normalized.clientSecret).toBe("secret");
  });

  it("requires complete PhonePe OAuth credentials when enabling", () => {
    const parsed = parseIncomingPhonePeForEnable({
      clientId: "PGTEST",
      clientVersion: "1",
      clientSecret: "secret",
      environment: "sandbox",
    });

    expect(parsed.success).toBe(true);
  });

  it("resolves PhonePe sandbox from environment hint", () => {
    expect(resolvePhonePeEnvironment("uat")).toBe("sandbox");
    expect(resolvePhonePeEnvironment("production")).toBe("production");
  });
});
