import { buildDispatchNotificationText } from "./dispatch-message";

describe("buildDispatchNotificationText", () => {
  it("includes order info and courier details", () => {
    const text = buildDispatchNotificationText({
      orderId: "SPT-001",
      customerName: "Ravi Kumar",
      courierName: "DTDC",
      trackingNumber: "D123456789",
      dispatchedAt: "2026-08-20T10:30:00.000Z",
      trackingUrlTemplate:
        "https://tracking.dtdc.com/ctbs-tracking/customerInterface.tr?submitType=get498498Status498498&cType=Consignment&cnNo={tracking}",
    });
    expect(text).toContain("Your order has been dispatched.");
    expect(text).toContain("Order ID: SPT-001");
    expect(text).toContain("Customer: Ravi Kumar");
    expect(text).toContain("Courier: DTDC");
    expect(text).toContain("Tracking number: D123456789");
    expect(text).toContain("Track here:");
    expect(text).not.toContain("Hub of craftss");
  });

  it("omits tracking line when no tracking number", () => {
    const text = buildDispatchNotificationText({
      orderId: "SPT-002",
      courierName: "India Post",
      dispatchedAt: "2026-08-20T10:30:00.000Z",
    });
    expect(text).not.toContain("Tracking number:");
    expect(text).not.toContain("Track here:");
  });
});
