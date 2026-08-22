"use client";

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { Mail, PhoneCall, ShoppingBag } from "lucide-react";
import { Icons } from "@/components/layouts/icons";
import { useCartCount } from "@/features/carts/hooks/useCartCount";
import { contactActionHref, type StoreContact } from "@/lib/contact/links";
import { useStorefrontContact } from "@/providers/ShopContactProvider";
import { useMobileMenu } from "./MobileMenuContext";
import {
  FloatingContactPicker,
  type ContactPickerMode,
} from "./FloatingContactPicker";

function CartBadge({ count }: { count: number }) {
  if (count <= 0) return null;

  return (
    <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-sm">
      {count > 9 ? "9+" : count}
    </span>
  );
}

const floatingActionButtonClass =
  "flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-transform hover:scale-105 active:scale-95 touch-manipulation";

function usableContacts(contacts: readonly StoreContact[]): StoreContact[] {
  return contacts.filter((contact) => {
    const href = contact.phoneHref?.trim() || "";
    const phone = contact.phone?.trim() || "";
    return Boolean(phone) && href !== "tel:" && href !== "";
  });
}

export function StoreFloatingActions() {
  const { isOpen: menuOpen } = useMobileMenu();
  const cartCount = useCartCount();
  const storefrontContact = useStorefrontContact();
  const phones = useMemo(
    () => usableContacts(storefrontContact.contacts),
    [storefrontContact.contacts],
  );
  const shopEmail = storefrontContact.email?.trim() || "";
  const [openPicker, setOpenPicker] = useState<ContactPickerMode | null>(null);

  const handlePickerChange = useCallback(
    (mode: ContactPickerMode, open: boolean) => {
      setOpenPicker(open ? mode : null);
    },
    [],
  );

  if (menuOpen) return null;

  const multiContact = phones.length > 1;
  const single = phones[0];

  return (
    <>
      {openPicker ? (
        <div
          className="fixed inset-0 z-[225] bg-black/10 backdrop-blur-[1px] md:pointer-events-none md:bg-transparent md:backdrop-blur-none"
          aria-hidden
          onClick={() => setOpenPicker(null)}
        />
      ) : null}

      <div
        className="fixed right-4 z-[230] flex flex-col items-end gap-3 bottom-[calc(var(--mobile-nav-height)+1rem)] md:bottom-6"
        aria-label="Quick actions"
      >
        {phones.length > 0 ? (
          multiContact ? (
            <FloatingContactPicker
              mode="call"
              contacts={phones}
              isOpen={openPicker === "call"}
              onOpenChange={(open) => handlePickerChange("call", open)}
              triggerLabel="Call Sri Palani Textiles — choose a number"
              triggerClassName={`animate-phone-glow ${floatingActionButtonClass} bg-primary text-primary-foreground ring-2 ring-primary/40 shadow-sm shadow-primary/25`}
              triggerIcon={<PhoneCall className="h-5 w-5" strokeWidth={2} />}
            />
          ) : (
            <a
              href={contactActionHref(single, "call")}
              className={`animate-phone-glow ${floatingActionButtonClass} bg-primary text-primary-foreground ring-2 ring-primary/40 shadow-sm shadow-primary/25`}
              aria-label={`Call Sri Palani Textiles at ${single.phone}`}
            >
              <PhoneCall className="h-5 w-5" strokeWidth={2} />
            </a>
          )
        ) : null}

        <Link
          href="/cart"
          className={`relative ${floatingActionButtonClass} border border-border bg-card text-foreground shadow-[0_4px_16px_rgba(227,6,19,0.12)]`}
          aria-label={`Cart${cartCount > 0 ? `, ${cartCount} items` : ""}`}
        >
          <ShoppingBag className="h-5 w-5" strokeWidth={1.75} />
          <CartBadge count={cartCount} />
        </Link>

        {phones.length > 0 ? (
          multiContact ? (
            <FloatingContactPicker
              mode="whatsapp"
              contacts={phones}
              isOpen={openPicker === "whatsapp"}
              onOpenChange={(open) => handlePickerChange("whatsapp", open)}
              triggerLabel="Chat on WhatsApp — choose a contact"
              triggerClassName={`animate-whatsapp-glow ${floatingActionButtonClass} bg-[#25D366] text-white ring-2 ring-[#25D366]/40`}
              triggerIcon={<Icons.whatsapp className="h-5 w-5" />}
            />
          ) : (
            <a
              href={contactActionHref(single, "whatsapp")}
              target="_blank"
              rel="noopener noreferrer"
              className={`animate-whatsapp-glow ${floatingActionButtonClass} bg-[#25D366] text-white ring-2 ring-[#25D366]/40`}
              aria-label={`WhatsApp Sri Palani Textiles at ${single.phone}`}
            >
              <Icons.whatsapp className="h-5 w-5" />
            </a>
          )
        ) : null}

        {shopEmail ? (
          <a
            href={`mailto:${shopEmail}`}
            className={`${floatingActionButtonClass} border border-border bg-card text-foreground shadow-sm`}
            aria-label={`Email Sri Palani Textiles at ${shopEmail}`}
          >
            <Mail className="h-5 w-5" strokeWidth={1.75} />
          </a>
        ) : null}
      </div>
    </>
  );
}
