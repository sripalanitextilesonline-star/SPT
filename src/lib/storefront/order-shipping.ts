/** Shared order / shipping copy — short, plain words every buyer can follow. */

export const ORDER_SHIPPING = {
  title: "Order & shipping",
  /** Sidebar + page: main timings */
  processingLabel: "Processing time",
  processing: "4–5 working days",
  processingNote: "Large orders may take a little longer.",
  deliveryLabel: "Delivery",
  regions: [
    {
      place: "Tamil Nadu",
      placeShort: "Tamil Nadu",
      time: "2–3 working days",
    },
    {
      place: "Other states in India",
      placeShort: "Other India",
      time: "5–6 working days",
    },
    {
      place: "Outside India",
      placeShort: "Outside India",
      time: "15–20 working days",
    },
  ] as const,
  readyStock: "In-stock items usually ship sooner after we confirm.",
  tracking: "When we ship, you get an email with tracking.",
  contactPrompt: "No email in 10–15 working days? Contact us:",
  wholesale: "Wholesale: timing depends on order size.",
  fullDetailsHref: "/shipping-returns",
  fullDetailsLabel: "Full details",
  contactWhatsApp: "WhatsApp",
  contactEmail: "Email",
} as const;

export const ORDER_SHIPPING_FALLBACK = {
  email: "",
  whatsappPhoneDigits: "919092467372",
} as const;

/** Shared returns / exchange copy — keep every storefront surface in sync. */
export const ORDER_RETURNS = {
  windowDays: 7,
  summary:
    "Returns or exchanges may be accepted within 7 days of delivery for unused items with original packaging intact.",
  /** Short blurb for PDP accordion / trust strip */
  short:
    "Returns or exchanges may be accepted within 7 days for unused items with packaging; please call before returning.",
  faqAnswer:
    "Unused items in original condition may be returned within 7 days. Please read our Shipping & Returns page and contact us before sending anything back.",
  trustTitle: "Easy Replacement",
  trustDescription: "Simple returns on eligible items.",
  rules: [
    "Please call or WhatsApp us before sending any item back.",
    "Customised, opened, or used items cannot be returned.",
    "Shipping charges for returns may apply unless the item is faulty.",
  ] as const,
  fullDetailsHref: "/shipping-returns",
} as const;
