import InfoPage from "@/components/layouts/InfoPage";
import { siteConfig } from "@/config/site";
import Link from "next/link";
import { Metadata } from "next";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Payment Methods | Sri Palani Textiles",
  description: "How to pay for sarees and textiles at Sri Palani Textiles",
};

export default function PaymentMethodsPage() {
  return (
    <InfoPage
      heading="Payment Methods"
      description="Secure online checkout for Sri Palani Textiles orders."
    >
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">
          Online orders
        </h2>
        <p>
          When you checkout on our website, you can pay securely using UPI,
          major debit and credit cards, and net banking through our payment
          partners (Cashfree / PhonePe). All transactions are processed in{" "}
          <strong>Indian Rupees (INR)</strong>.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">In-store</h2>
        <p>
          Visit us at our Elampillai store to pay by cash, UPI, or card. Our
          team can help you choose silk and cotton sarees.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">
          Custom orders
        </h2>
        <p>
          For large or custom orders, you may arrange payment via UPI or bank
          transfer after confirming details by{" "}
          <Link href="/contact" className="text-primary hover:underline">
            email
          </Link>
          .
        </p>
      </section>
    </InfoPage>
  );
}
