import { siteConfig } from "@/config/site";
import {
  PACKING_SLIP_BRAND,
  PACKING_SLIP_THANKS,
  formatPackingSlipDate,
  formatPackingSlipOrderHeading,
  formatPackingSlipQuantity,
  buildPackingSlipRecipientLines,
  buildPackingSlipShopFooter,
  resolvePackingSlipShopAddressLines,
} from "./packing-slip-format";

describe("packing slip format (Sri Palani Textiles)", () => {
  it("prints quantity as 1 of 1", () => {
    expect(formatPackingSlipQuantity(1)).toBe("1 of 1");
    expect(formatPackingSlipQuantity(3)).toBe("3 of 3");
  });

  it("prints Order # heading", () => {
    expect(formatPackingSlipOrderHeading("INV-0501201")).toBe(
      "Order #INV-0501201",
    );
  });

  it("prints date like 16 August 2026 in IST", () => {
    expect(formatPackingSlipDate("2026-08-16T06:00:00.000Z")).toBe(
      "16 August 2026",
    );
  });

  it("puts name, street, pincode city state, country, and phone on SHIP TO", () => {
    const lines = buildPackingSlipRecipientLines({
      customerName: "Anshula Tayal",
      customerMobile: "9654445244",
      includePhone: true,
      shippingAddress: {
        line1: "C-410 Sfs Flats Triveni Apartment",
        line2: "Sheikh Sarai phase 1",
        city: "New Delhi",
        state: "Delhi",
        postalCode: "110017",
        country: "India",
      },
    });
    expect(lines).toEqual([
      "Anshula Tayal",
      "C-410 Sfs Flats Triveni Apartment",
      "Sheikh Sarai phase 1",
      "110017 New Delhi DL",
      "India",
      "9654445244",
    ]);
  });

  it("omits phone on BILL TO", () => {
    const lines = buildPackingSlipRecipientLines({
      customerName: "Anshula Tayal",
      customerMobile: "9654445244",
      includePhone: false,
      shippingAddress: {
        line1: "C-410",
        line2: null,
        city: "New Delhi",
        state: "Delhi",
        postalCode: "110017",
        country: "India",
      },
    });
    expect(lines).not.toContain("9654445244");
    expect(lines.at(-1)).toBe("India");
  });

  it("brand is Sri Palani Textiles (siteConfig.name)", () => {
    expect(PACKING_SLIP_BRAND).toBe(siteConfig.name);
    expect(PACKING_SLIP_BRAND).toBe("Sri Palani Textiles");
    expect(PACKING_SLIP_THANKS).toBe("Thank you for shopping with us!");
  });

  it("prints shop footer from SPT site defaults with mobile", () => {
    const footer = buildPackingSlipShopFooter();
    expect(footer.brand).toBe("Sri Palani Textiles");
    expect(footer.address).toContain("Elampillai");
    expect(footer.address).toMatch(/India$/);
    expect(footer.mobile).toContain("+91 90924 67372");
  });

  it("prints the admin shop-contact address on the packing slip footer", () => {
    const lines = resolvePackingSlipShopAddressLines({
      isEnabled: true,
      value: {
        addressLines: [
          "5/262, K.K. Nagar Keel Road",
          "Edanganasalai P.O, Elampillai",
          "Salem D.T – 637502, Tamil Nadu",
          "India",
        ],
      },
    });
    const footer = buildPackingSlipShopFooter(lines);
    expect(footer.address).toBe(
      "5/262, K.K. Nagar Keel Road, Edanganasalai P.O, Elampillai, Salem D.T – 637502, Tamil Nadu, India",
    );
  });

  it("falls back to the code address when admin shop contact is off", () => {
    const lines = resolvePackingSlipShopAddressLines({
      isEnabled: false,
      value: { addressLines: ["Should not print"] },
    });
    expect(buildPackingSlipShopFooter(lines).address).toContain("Elampillai");
  });
});
