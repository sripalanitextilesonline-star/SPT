import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  Circle,
  ExternalLink,
  Package,
  Truck,
} from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { Shell } from "@/components/layouts/Shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import OrderCompletionCleaner from "@/features/orders/components/OrderCompletionCleaner";
import { canViewOrder } from "@/lib/auth/order-access";
import { appendFromToSignIn } from "@/lib/auth/redirect";
import { formatOrderDateTimeIst } from "@/lib/datetime/india";
import { getOrderDispatchInfo } from "@/lib/dispatch/get-order-dispatch-info";
import {
  resolveOrderLineImageAlt,
  resolveOrderLineImageKey,
  resolveOrderLineProductName,
  resolveOrderLineProductSlug,
} from "@/lib/orders/order-line-display";
import {
  FULFILLMENT_STEPS,
  resolveFulfillmentStepIndex,
  resolveStorefrontOrderDescription,
  resolveStorefrontOrderHeadline,
  resolveStorefrontOrderPaymentView,
  shouldShowFulfillmentProgress,
} from "@/lib/orders/paymentStatus";
import db from "@/lib/supabase/db";
import {
  address,
  medias,
  orderLines,
  orders,
  products,
} from "@/lib/supabase/schema";
import { formatDate, formatPrice, keytoUrl } from "@/lib/utils";
import { eq } from "drizzle-orm";
import Image from "next/image";

type TrackOrderProps = {
  params: Promise<{ orderId: string }>;
  searchParams?: Promise<{ token?: string }>;
};

function paymentBadgeClass(view: ReturnType<typeof resolveStorefrontOrderPaymentView>) {
  switch (view) {
    case "confirmed":
      return "border-emerald-600 text-emerald-700";
    case "payment_pending":
      return "border-amber-600 text-amber-700";
    case "payment_failed":
    case "cancelled":
      return "border-destructive text-destructive";
    default:
      return "";
  }
}

function paymentAlertClass(view: ReturnType<typeof resolveStorefrontOrderPaymentView>) {
  switch (view) {
    case "confirmed":
      return "border-emerald-200 bg-emerald-50 text-emerald-900";
    case "payment_pending":
      return "border-amber-200 bg-amber-50 text-amber-950";
    case "payment_failed":
    case "cancelled":
      return "border-destructive/30 bg-destructive/5 text-destructive";
    default:
      return "border-muted bg-muted/40 text-foreground";
  }
}

function buildShippingAddress(details: {
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
}) {
  const lines = [details.line1, details.line2].filter(Boolean);
  const cityLine =
    `${details.city || "-"}, ${details.state || "-"} ${details.postalCode || ""}`.trim();
  return [...lines, cityLine, details.country || "India"].filter(Boolean);
}

async function TrackOrderPage({ params, searchParams }: TrackOrderProps) {
  const { orderId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const orderRows = await db
    .select({
      id: orders.id,
      user_id: orders.user_id,
      createdAt: orders.createdAt,
      amount: orders.amount,
      currency: orders.currency,
      orderStatus: orders.order_status,
      paymentStatus: orders.payment_status,
      paymentProvider: orders.payment_provider,
      customerName: orders.name,
      customerEmail: orders.email,
      customerMobile: orders.customer_mobile,
      addressLine1: address.line1,
      addressLine2: address.line2,
      addressCity: address.city,
      addressState: address.state,
      addressPostalCode: address.postal_code,
      addressCountry: address.country,
    })
    .from(orders)
    .leftJoin(address, eq(orders.addressId, address.id))
    .where(eq(orders.id, orderId))
    .limit(1);

  const order = orderRows[0];
  if (!order) return notFound();

  const allowed = await canViewOrder(
    {
      id: order.id,
      user_id: order.user_id,
      createdAt: order.createdAt,
    },
    resolvedSearchParams?.token,
  );

  if (!allowed) {
    if (order.user_id) {
      redirect(
        appendFromToSignIn("/sign-in", `/orders/${orderId}`, {
          error: "Sign in to view this order.",
        }),
      );
    }
    notFound();
  }

  const lineRows = await db
    .select({
      id: orderLines.id,
      quantity: orderLines.quantity,
      unitPrice: orderLines.price,
      productName: products.name,
      productSlug: products.slug,
      productNameSnapshot: orderLines.productNameSnapshot,
      productSlugSnapshot: orderLines.productSlugSnapshot,
      productImageKeySnapshot: orderLines.productImageKeySnapshot,
      imageKey: medias.key,
      imageAlt: medias.alt,
    })
    .from(orderLines)
    .leftJoin(products, eq(orderLines.productId, products.id))
    .leftJoin(medias, eq(products.featuredImageId, medias.id))
    .where(eq(orderLines.orderId, orderId));

  const paymentView = resolveStorefrontOrderPaymentView({
    payment_status: order.paymentStatus,
    order_status: order.orderStatus,
  });
  const orderHeadline = resolveStorefrontOrderHeadline({
    payment_status: order.paymentStatus,
    order_status: order.orderStatus,
  });
  const orderDescription = resolveStorefrontOrderDescription({
    payment_status: order.paymentStatus,
    order_status: order.orderStatus,
  });
  const stepIndex = resolveFulfillmentStepIndex({
    payment_status: order.paymentStatus,
    order_status: order.orderStatus,
  });
  const showFulfillmentProgress = shouldShowFulfillmentProgress({
    payment_status: order.paymentStatus,
    order_status: order.orderStatus,
  });
  const shippingLines = buildShippingAddress({
    line1: order.addressLine1,
    line2: order.addressLine2,
    city: order.addressCity,
    state: order.addressState,
    postalCode: order.addressPostalCode,
    country: order.addressCountry,
  });
  const dispatchInfo = await getOrderDispatchInfo(orderId);

  return (
    <Shell layout="narrow">
      <OrderCompletionCleaner clearGuestCart={order.paymentStatus === "paid"} />

      <div className="space-y-4 pb-20 md:pb-6">
        <Card>
          <CardHeader className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-lg sm:text-xl">{orderHeadline}</CardTitle>
              <Badge
                variant="outline"
                className={`capitalize ${paymentBadgeClass(paymentView)}`}
              >
                {order.paymentStatus.replaceAll("_", " ")}
              </Badge>
            </div>
            <div
              className={`flex gap-2 rounded-md border px-3 py-2 text-sm ${paymentAlertClass(paymentView)}`}
            >
              {paymentView === "confirmed" ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <p>{orderDescription}</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Order ID:{" "}
              <span className="font-medium text-foreground">#{order.id}</span>
              {" • "}
              Placed on {formatDate(order.createdAt)}
            </p>
            <p className="text-sm text-muted-foreground">
              Payment:{" "}
              <span className="capitalize text-foreground">
                {order.paymentProvider || "online"}
              </span>
              {" • "}
              Total:{" "}
              <span className="font-medium text-foreground">
                {formatPrice(
                  Number(order.amount),
                  (order.currency || "INR").toUpperCase(),
                )}
              </span>
            </p>
          </CardHeader>
          <CardContent>
            {showFulfillmentProgress ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {FULFILLMENT_STEPS.map((step, idx) => {
                  const completed = idx <= stepIndex;
                  return (
                    <div
                      key={step}
                      className="flex items-center gap-2 rounded-md border px-3 py-2"
                    >
                      {completed ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="text-xs font-medium capitalize">
                        {step}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Order tracking will appear here after payment is confirmed.
              </p>
            )}
          </CardContent>
        </Card>

        {dispatchInfo ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Shipment Tracking</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>
                <span className="text-muted-foreground">Courier:</span>{" "}
                {dispatchInfo.courierName}
              </p>
              <p>
                <span className="text-muted-foreground">Dispatched:</span>{" "}
                {formatOrderDateTimeIst(dispatchInfo.dispatchedAt)}
              </p>
              {dispatchInfo.trackingNumber ? (
                <p className="break-all">
                  <span className="text-muted-foreground">
                    Tracking number:
                  </span>{" "}
                  {dispatchInfo.trackingNumber}
                </p>
              ) : null}
              {dispatchInfo.trackingUrl ? (
                <Button asChild>
                  <a
                    href={dispatchInfo.trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Track shipment
                  </a>
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Shipping Address</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p className="font-medium">{order.customerName || "Customer"}</p>
              {order.customerMobile ? (
                <p className="text-muted-foreground">{order.customerMobile}</p>
              ) : null}
              {shippingLines.map((line) => (
                <p key={line} className="text-muted-foreground">
                  {line}
                </p>
              ))}
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Items in this Order</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {lineRows.map((line) => {
                const productName = resolveOrderLineProductName(line);
                const productSlug = resolveOrderLineProductSlug(line);
                const imageKey = resolveOrderLineImageKey(line);
                const imageAlt = resolveOrderLineImageAlt(line);

                return (
                  <div
                    key={line.id}
                    className="flex items-center gap-3 rounded-md border p-2.5"
                  >
                    <div className="relative h-14 w-14 overflow-hidden rounded-md border bg-muted">
                      {imageKey ? (
                        <Image
                          src={keytoUrl(imageKey)}
                          alt={imageAlt}
                          fill
                          className="object-cover"
                          sizes="56px"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                          No image
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      {productSlug ? (
                        <Link
                          href={`/shop/${productSlug}`}
                          className="line-clamp-1 text-sm font-medium hover:underline"
                        >
                          {productName}
                        </Link>
                      ) : (
                        <p className="line-clamp-1 text-sm font-medium">
                          {productName}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Qty: {line.quantity} •{" "}
                        {formatPrice(Number(line.unitPrice))}
                      </p>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap gap-2">
          {paymentView === "payment_pending" ? (
            <Button asChild>
              <Link href="/cart">Return to cart to pay again</Link>
            </Button>
          ) : null}
          <Button asChild variant="outline">
            <Link href="/shop">
              <Package className="mr-2 h-4 w-4" />
              Continue Shopping
            </Link>
          </Button>
          {order.customerEmail ? (
            <Button asChild variant="outline">
              <a href={`mailto:${order.customerEmail}`}>
                <Truck className="mr-2 h-4 w-4" />
                Contact Support
              </a>
            </Button>
          ) : null}
        </div>
      </div>
    </Shell>
  );
}

export default TrackOrderPage;
