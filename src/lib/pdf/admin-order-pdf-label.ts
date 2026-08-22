import { siteConfig } from "@/config/site";
import type { AdminOrderListView } from "@/lib/admin/getAdminOrdersList";
import type { PdfLabelOrder } from "@/lib/pdf/shipping-label-pdf";
import type { PackingSlipOrder } from "@/lib/pdf/packing-slip-pdf";

/** Shop FROM block for parcel labels (matches Software-Saree-order sender_details). */
export function buildAdminPdfSenderDetails(): string {
  const lines = [
    siteConfig.name,
    ...siteConfig.addressLines,
    siteConfig.phone ? `Ph: ${siteConfig.phone}` : null,
    siteConfig.gstin ? `GSTIN: ${siteConfig.gstin}` : null,
  ].filter((line): line is string => Boolean(line && line.trim()));

  return lines.join("\n");
}

export function adminOrderToPdfLabel(
  order: Pick<AdminOrderListView, "id" | "copyAddressText">,
  senderDetails = buildAdminPdfSenderDetails(),
): PdfLabelOrder {
  return {
    id: order.id,
    sender_details: senderDetails,
    recipient_details: order.copyAddressText || "Address not available",
  };
}

export function adminOrdersToPdfLabels(
  orders: Pick<AdminOrderListView, "id" | "copyAddressText">[],
): PdfLabelOrder[] {
  const sender = buildAdminPdfSenderDetails();
  return orders.map((order) => adminOrderToPdfLabel(order, sender));
}

/** Map an AdminOrderListView to packing-slip data. */
export function adminOrderToPackingSlip(
  order: AdminOrderListView,
): PackingSlipOrder {
  return {
    id: order.id,
    createdAt: order.createdAt,
    customerName: order.customerName,
    customerMobile: order.customerMobile,
    shippingAddress: order.shippingAddress,
    items: order.lines.map((line) => ({
      name: line.productName,
      quantity: line.quantity,
      imageUrl: line.imageUrl,
    })),
  };
}

/** Map multiple orders for bulk packing-slip download. */
export function adminOrdersToPackingSlips(
  orders: AdminOrderListView[],
): PackingSlipOrder[] {
  return orders.map(adminOrderToPackingSlip);
}
