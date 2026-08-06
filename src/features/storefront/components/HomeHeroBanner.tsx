import Image from "next/image";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { BRAND_LOGO } from "@/lib/brand/logo";
import { cn } from "@/lib/utils";

const HERO_IMAGE =
  "https://pub-65f24d69fb304b0b87901be92e533cb1.r2.dev/public/silk-sarees.jpg";

export function HomeHeroBanner() {
  return (
    <section className="w-full min-w-0 overflow-hidden bg-background">
      <div className="container px-4 sm:px-6 pt-2 pb-1 md:pt-5 md:pb-3">
        <Link
          href="/shop"
          className="relative block w-full max-w-full overflow-hidden rounded-2xl shadow-md aspect-[2/1] sm:aspect-[5/2] md:aspect-[21/9] md:max-h-[480px]"
        >
          <Image
            src={HERO_IMAGE}
            alt={`${siteConfig.name} — silk sarees`}
            fill
            priority
            sizes="(max-width: 768px) 100vw, 1200px"
            className="object-cover object-[center_25%] sm:object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-auto">
            <Image
              src={BRAND_LOGO.src}
              alt={siteConfig.name}
              width={BRAND_LOGO.width}
              height={BRAND_LOGO.height}
              className="h-12 w-auto object-contain drop-shadow-md sm:h-16 md:h-20"
              priority
            />
            <p className="mt-2 max-w-md text-sm font-medium text-white/95 sm:text-base">
              {siteConfig.tagline} — manufacturers of handloom cloth &amp;
              sarees
            </p>
          </div>
        </Link>
        <div className="mt-4 hidden justify-center md:flex">
          <Link
            href="/shop"
            className={cn(buttonVariants({ size: "lg" }), "rounded-full px-10")}
          >
            Shop sarees
          </Link>
        </div>
      </div>
    </section>
  );
}
