import InfoPage from "@/components/layouts/InfoPage";
import { resolveStorefrontContact } from "@/lib/integrations/settings";
import Link from "next/link";
import { Metadata } from "next";
import { siteConfig } from "@/config/site";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: `FAQ | ${siteConfig.name}`,
  description: `Frequently asked questions about ${siteConfig.name} sarees and textiles`,
};

const faqs = [
  {
    q: "Do you sell wholesale?",
    a: "Yes. We offer wholesale and bulk pricing for retailers. Call or WhatsApp us with your requirements.",
  },
  {
    q: "How do I track my order?",
    a: "After checkout you will receive confirmation. Log in and visit My Orders, or contact us with your order number for an update.",
  },
  {
    q: "Can I visit your store?",
    a: `Yes. We are at ${siteConfig.address}. See our Contact page for phones and directions.`,
  },
  {
    q: "What do you sell?",
    a: "Handloom cloth and sarees — silk, cotton, wedding and festive collections. Each product listing describes the material and style.",
  },
  {
    q: "How do returns work?",
    a: "Unused items in original condition may be returned within 7 days. Please read our Shipping & Returns page and contact us before sending anything back.",
  },
];

export default async function FaqPage() {
  const contact = await resolveStorefrontContact();

  return (
    <InfoPage
      heading="FAQ"
      description={`Common questions about shopping with ${siteConfig.name}.`}
    >
      <div className="space-y-6">
        {faqs.map((item) => (
          <section key={item.q} className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">
              {item.q}
            </h2>
            <p className="text-muted-foreground">{item.a}</p>
          </section>
        ))}
      </div>

      <p className="pt-2 text-sm text-muted-foreground">
        Still need help?{" "}
        <Link href="/contact" className="text-primary hover:underline">
          Contact us
        </Link>
        {contact.phone ? (
          <>
            {" "}
            or call{" "}
            <Link
              href={contact.phoneHref}
              className="text-primary hover:underline"
            >
              {contact.phone}
            </Link>
          </>
        ) : null}
        .
      </p>
    </InfoPage>
  );
}
