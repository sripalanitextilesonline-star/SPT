import { siteConfig } from "@/config/site";
import { BRAND_LOGO } from "@/lib/brand/logo";

export type HeroSlide = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  cta: string;
  image: string;
  imageAlt: string;
};

const CDN = "https://pub-65f24d69fb304b0b87901be92e533cb1.r2.dev";

/** Homepage hero — brand logo + sample saree photos. */
export const heroSlides: HeroSlide[] = [
  {
    id: "brand",
    title: siteConfig.name,
    subtitle: siteConfig.tagline,
    href: "/shop",
    cta: "Shop now",
    image: BRAND_LOGO.src,
    imageAlt: `${siteConfig.name} — ${siteConfig.tagline}`,
  },
  {
    id: "silk-sarees",
    title: "Silk sarees",
    subtitle: "Wedding and festive silk collections",
    href: "/shop",
    cta: "Shop now",
    image: `${CDN}/public/silk-sarees.jpg`,
    imageAlt: `${siteConfig.name} — silk sarees`,
  },
  {
    id: "cotton-sarees",
    title: "Cotton & everyday wear",
    subtitle: "Comfortable cotton and silk-cotton sarees",
    href: "/collections",
    cta: "Explore",
    image: `${CDN}/public/cotton-sarees.jpg`,
    imageAlt: `${siteConfig.name} — cotton sarees`,
  },
];
