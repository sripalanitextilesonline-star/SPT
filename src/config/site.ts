import type { NavItemWithOptionalChildren } from "@/types";

export type SiteConfig = typeof siteConfig;

/** Sri Palani Textiles — Elampillai, Salem */
const ADDRESS_LINES = [
  "5/262, K.K. Nagar Keel Road",
  "Near Vinayagar Kovil",
  "Edanganasalai P.O, Elampillai",
  "Salem D.T – 637502, Tamil Nadu",
] as const;

/** Store phone (India) — used by footer, contact page, and floating call/WhatsApp */
const CONTACTS = [
  {
    name: "Shop",
    phone: "+91 90924 67372",
    phoneHref: "tel:+919092467372",
  },
] as const;

const PHONE = CONTACTS[0].phone;
const PHONE_HREF = CONTACTS[0].phoneHref;
const EMAIL = "";
const GSTIN = "";

const SOCIAL = {
  instagram: "",
  youtube: "",
  facebook: "",
  whatsapp: "https://wa.me/919092467372",
} as const;

export const siteConfig = {
  /** Title-case shop board line (navbar/footer wordmark) */
  shopBoardName: "Sri Palani Textiles",
  name: "Sri Palani Textiles",
  shortName: "SPT",
  tagline: "Quality Speak",
  /** Town shown on shop board / navbar */
  location: "ELAMPILLAI",
  description:
    "Manufacturers of handloom cloth & sarees — premium silk, cotton, wedding and festive collections from Sri Palani Textiles, Elampillai, Salem.",
  searchPlaceholder: "Search sarees, collections…",
  url: "https://sripalanitextiles.com",
  addressLines: ADDRESS_LINES,
  /** Single-line address for compact UI */
  address: ADDRESS_LINES.join(", "),
  /** Structured address for SEO / JSON-LD */
  addressLocality: "Elampillai",
  addressRegion: "Tamil Nadu",
  postalCode: "637502",
  phone: PHONE,
  /** `tel:` href (digits only, with country code) */
  phoneHref: PHONE_HREF,
  /** All store / contact numbers */
  contacts: CONTACTS,
  email: EMAIL,
  gstin: GSTIN,
  currency: "INR",
  currencySymbol: "₹",
  social: SOCIAL,
  /** Top offer ribbon — rotates on the storefront */
  announcements: [
    {
      text: "Quality Speak — manufacturers of handloom cloth & sarees",
      href: "/shop",
      cta: "Shop now",
    },
    {
      text: "Wedding & festive collections available",
      href: "/collections",
      cta: "Browse",
    },
    {
      text: "Contact us for store visits and orders",
      href: "/contact",
      cta: "Contact",
    },
  ],
  mainNav: [
    {
      title: "Collections",
      href: "/collections",
      description: "Browse saree collections.",
      items: [],
    },
    {
      title: "Featured",
      href: "/featured",
      description: "Handpicked sarees.",
      items: [],
    },
    {
      title: "Orders",
      href: "/orders",
      description: "Your orders.",
      items: [],
    },
  ] satisfies NavItemWithOptionalChildren[],

  /** Storefront footer columns */
  footerNav: [
    {
      title: "Shop",
      items: [
        { title: "All products", href: "/shop", items: [] },
        { title: "Featured", href: "/featured", items: [] },
        { title: "All categories", href: "/collections", items: [] },
        { title: "Wishlist", href: "/wish-list", items: [] },
        { title: "Cart", href: "/cart", items: [] },
      ],
    },
    {
      title: "Explore",
      items: [
        { title: "Collections", href: "/collections", items: [] },
        { title: "Featured picks", href: "/featured", items: [] },
        { title: "Our story", href: "/about", items: [] },
        { title: "Contact", href: "/contact", items: [] },
      ],
    },
    {
      title: "Customer Service",
      items: [
        {
          title: "Terms & Conditions",
          href: "/terms-and-conditions",
          items: [],
        },
        { title: "Terms of Use", href: "/terms-of-use", items: [] },
        { title: "Privacy Policy", href: "/privacy-policy", items: [] },
        { title: "Shipping & Returns", href: "/shipping-returns", items: [] },
        { title: "Payment Methods", href: "/payment-methods", items: [] },
        { title: "FAQ", href: "/faq", items: [] },
        { title: "My orders", href: "/orders", items: [] },
      ],
    },
    {
      title: "About Sri Palani Textiles",
      items: [
        { title: "Our Story", href: "/about", items: [] },
        { title: "Our Collections", href: "/collections", items: [] },
        { title: "Visit our store", href: "/contact#store", items: [] },
        { title: "Contact", href: "/contact", items: [] },
      ],
    },
  ] satisfies NavItemWithOptionalChildren[],
};
