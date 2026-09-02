export type OrderPaymentSnapshot = {
  payment_status: string | null | undefined;
  order_status?: string | null | undefined;
};

export type StorefrontOrderPaymentView =
  | "confirmed"
  | "payment_pending"
  | "payment_failed"
  | "cancelled";

export function normalizeOrderStatus(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function isPaidPaymentStatus(
  paymentStatus: string | null | undefined,
): boolean {
  const normalized = normalizeOrderStatus(paymentStatus);
  return (
    normalized === "paid" ||
    normalized === "success" ||
    normalized === "captured"
  );
}

export function isCanceledOrderStatus(
  orderStatus: string | null | undefined,
): boolean {
  const normalized = normalizeOrderStatus(orderStatus);
  return normalized === "canceled" || normalized === "cancelled";
}

export function isFailedPaymentStatus(
  paymentStatus: string | null | undefined,
): boolean {
  return normalizeOrderStatus(paymentStatus) === "failed";
}

/**
 * Storefront order detail must never show "confirmed" until payment is paid.
 * Backend keeps unpaid orders at order_status=pending; only the UI was wrong.
 */
export function resolveStorefrontOrderPaymentView(
  order: OrderPaymentSnapshot,
): StorefrontOrderPaymentView {
  if (isPaidPaymentStatus(order.payment_status)) {
    return "confirmed";
  }
  if (isCanceledOrderStatus(order.order_status)) {
    return "cancelled";
  }
  if (isFailedPaymentStatus(order.payment_status)) {
    return "payment_failed";
  }
  return "payment_pending";
}

export function resolveStorefrontOrderHeadline(
  order: OrderPaymentSnapshot,
): string {
  switch (resolveStorefrontOrderPaymentView(order)) {
    case "confirmed":
      return "Order Confirmed";
    case "cancelled":
      return "Order Cancelled";
    case "payment_failed":
      return "Payment Failed";
    default:
      return "Payment Pending";
  }
}

export function resolveStorefrontOrderDescription(
  order: OrderPaymentSnapshot,
): string {
  switch (resolveStorefrontOrderPaymentView(order)) {
    case "confirmed":
      return "Thank you — your payment was received and we are preparing your order.";
    case "cancelled":
      return "This order was cancelled because payment was not completed. No amount has been confirmed for this order.";
    case "payment_failed":
      return "We could not confirm your payment. If any amount was deducted, contact us with your order ID and we will help.";
    default:
      return "Your order is saved, but it is not confirmed until payment succeeds. Complete payment on the gateway or place a new order from your cart.";
  }
}

const FULFILLMENT_STEPS = ["ordered", "packed", "shipped", "delivered"] as const;

function normalizeFulfillmentStatus(status: string | null | undefined) {
  const s = normalizeOrderStatus(status);
  if (s.includes("deliver")) return "delivered";
  if (s.includes("ship") || s.includes("dispatch")) return "shipped";
  if (s.includes("pack") || s.includes("prepar")) return "packed";
  return "ordered";
}

/**
 * Fulfillment progress is only meaningful after payment. Unpaid/cancelled orders
 * return -1 so no step appears completed.
 */
export function resolveFulfillmentStepIndex(
  order: OrderPaymentSnapshot,
): number {
  if (!isPaidPaymentStatus(order.payment_status)) {
    return -1;
  }

  const normalized = normalizeFulfillmentStatus(order.order_status);
  const idx = FULFILLMENT_STEPS.indexOf(
    normalized as (typeof FULFILLMENT_STEPS)[number],
  );
  return idx === -1 ? 0 : idx;
}

export function shouldShowFulfillmentProgress(
  order: OrderPaymentSnapshot,
): boolean {
  return isPaidPaymentStatus(order.payment_status);
}

export function needsPaymentAttention(order: OrderPaymentSnapshot): boolean {
  const paymentStatus = normalizeOrderStatus(order.payment_status);
  const orderStatus = normalizeOrderStatus(order.order_status);

  if (orderStatus === "cancelled") return false;
  if (orderStatus === "pending") return true;

  return (
    paymentStatus === "unpaid" ||
    paymentStatus === "pending" ||
    paymentStatus === "failed"
  );
}

export { FULFILLMENT_STEPS };
