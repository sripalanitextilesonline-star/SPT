import InfoPage from "@/components/layouts/InfoPage";
import Link from "next/link";
import { Metadata } from "next";
import { siteConfig } from "@/config/site";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: `Our Story | ${siteConfig.name}`,
  description: `About ${siteConfig.name} — handloom cloth and sarees from Elampillai, Salem.`,
};

export default function AboutPage() {
  return (
    <InfoPage
      heading="Our Story"
      description={`${siteConfig.name} — ${siteConfig.tagline}.`}
    >
      <p>
        {siteConfig.name} manufactures handloom cloth and sarees — silk, cotton,
        wedding and festive collections with the care of a traditional textile
        house.
      </p>
      <p>
        Visit us in Elampillai, Salem ({siteConfig.address}). Call{" "}
        <a href={siteConfig.phoneHref} className="text-primary hover:underline">
          {siteConfig.phone}
        </a>
        {siteConfig.contacts[1] ? (
          <>
            {" "}
            or{" "}
            <a
              href={siteConfig.contacts[1].phoneHref}
              className="text-primary hover:underline"
            >
              {siteConfig.contacts[1].phone}
            </a>
          </>
        ) : null}{" "}
        for store visits, stock checks, and wholesale enquiries.
      </p>
      <p>
        Browse our{" "}
        <Link href="/collections" className="text-primary hover:underline">
          collections
        </Link>
        , explore{" "}
        <Link href="/featured" className="text-primary hover:underline">
          featured products
        </Link>
        , or{" "}
        <Link href="/contact" className="text-primary hover:underline">
          get in touch
        </Link>{" "}
        for orders and enquiries.
      </p>
    </InfoPage>
  );
}
