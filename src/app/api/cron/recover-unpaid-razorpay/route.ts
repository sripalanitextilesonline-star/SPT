import { NextRequest, NextResponse } from "next/server";
import {
  recoverUnpaidRazorpayOrders,
  repairPaidRazorpaySideEffects,
} from "@/lib/payments/recover-unpaid-razorpay-orders";
import { withRetry } from "@/lib/resilience";

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;

  const authHeader = request.headers.get("authorization")?.trim() ?? "";
  if (authHeader === `Bearer ${secret}`) return true;

  return request.headers.get("x-cron-secret")?.trim() === secret;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { ok: false, message: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    const recovered = await withRetry(
      () => recoverUnpaidRazorpayOrders({ lookbackDays: 14, limit: 40 }),
      { label: "cron:recover-unpaid-razorpay", attempts: 3 },
    );
    const repaired = await withRetry(
      () => repairPaidRazorpaySideEffects({ lookbackDays: 14, limit: 30 }),
      { label: "cron:repair-side-effects", attempts: 3 },
    );
    return NextResponse.json({ ok: true, recovered, repaired });
  } catch (error) {
    console.error("[cron] recover-unpaid-razorpay failed:", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
