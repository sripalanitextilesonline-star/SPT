import {
  FULFILLMENT_STEPS,
  resolveFulfillmentStepIndex,
  resolveStorefrontOrderDescription,
  resolveStorefrontOrderHeadline,
  resolveStorefrontOrderPaymentView,
  shouldShowFulfillmentProgress,
} from "./paymentStatus";

describe("paymentStatus storefront presentation", () => {
  it("does not show confirmed for unpaid pending orders", () => {
    const order = { payment_status: "unpaid", order_status: "pending" };
    expect(resolveStorefrontOrderPaymentView(order)).toBe("payment_pending");
    expect(resolveStorefrontOrderHeadline(order)).toBe("Payment Pending");
    expect(resolveStorefrontOrderHeadline(order)).not.toBe("Order Confirmed");
    expect(shouldShowFulfillmentProgress(order)).toBe(false);
    expect(resolveFulfillmentStepIndex(order)).toBe(-1);
  });

  it("shows confirmed only when payment is paid", () => {
    const order = { payment_status: "paid", order_status: "PREPARING" };
    expect(resolveStorefrontOrderPaymentView(order)).toBe("confirmed");
    expect(resolveStorefrontOrderHeadline(order)).toBe("Order Confirmed");
    expect(shouldShowFulfillmentProgress(order)).toBe(true);
    expect(resolveFulfillmentStepIndex(order)).toBe(1);
  });

  it("maps cancelled unpaid orders to cancelled view", () => {
    const order = { payment_status: "unpaid", order_status: "canceled" };
    expect(resolveStorefrontOrderPaymentView(order)).toBe("cancelled");
    expect(resolveStorefrontOrderHeadline(order)).toBe("Order Cancelled");
    expect(resolveStorefrontOrderDescription(order)).toMatch(/cancelled/i);
  });

  it("maps failed payment to payment_failed view", () => {
    const order = { payment_status: "failed", order_status: "pending" };
    expect(resolveStorefrontOrderPaymentView(order)).toBe("payment_failed");
    expect(resolveStorefrontOrderHeadline(order)).toBe("Payment Failed");
  });

  it("exports four fulfillment steps", () => {
    expect(FULFILLMENT_STEPS).toEqual([
      "ordered",
      "packed",
      "shipped",
      "delivered",
    ]);
  });
});
