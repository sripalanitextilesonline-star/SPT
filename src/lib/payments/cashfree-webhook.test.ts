import {
  decideMissingCashfreeOrderId,
  extractCashfreeWebhookOrderId,
  parseCashfreeWebhookTimestampMs,
} from "./cashfree-webhook";

describe("cashfree-webhook", () => {
  it("extracts order_id from nested 2026-style payload", () => {
    const orderId = extractCashfreeWebhookOrderId({
      type: "PAYMENT_SUCCESS_WEBHOOK",
      data: {
        order: { order_id: "order_abc" },
        payment: { cf_payment_id: "pay_1" },
      },
    });

    expect(orderId).toBe("order_abc");
  });

  it("requests retry when payment webhook lacks order_id", () => {
    expect(decideMissingCashfreeOrderId("PAYMENT_SUCCESS_WEBHOOK").action).toBe(
      "retry",
    );
    expect(decideMissingCashfreeOrderId("SETTLEMENT_WEBHOOK").action).toBe(
      "skip",
    );
  });

  it("normalizes second and millisecond timestamps", () => {
    expect(parseCashfreeWebhookTimestampMs("1746427759")).toBe(1746427759000);
    expect(parseCashfreeWebhookTimestampMs("1746427759733")).toBe(
      1746427759733,
    );
    expect(parseCashfreeWebhookTimestampMs("invalid")).toBeNull();
  });
});
