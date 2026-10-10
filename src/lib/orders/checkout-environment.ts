import type {
  CashfreeConfig,
  PhonePeConfig,
  RazorpayConfig,
} from "@/lib/integrations/settings";

export function resolveCheckoutPaymentEnvironment(params: {
  preferRazorpay?: boolean;
  preferCashfree: boolean;
  preferPhonePe: boolean;
  razorpayConfig?: RazorpayConfig | null;
  cashfreeConfig: CashfreeConfig | null;
  phonePeConfig: PhonePeConfig | null;
}): "sandbox" | "production" {
  if (params.preferRazorpay && params.razorpayConfig) {
    return params.razorpayConfig.environment;
  }

  if (params.preferCashfree && params.cashfreeConfig) {
    return params.cashfreeConfig.environment;
  }

  if (params.preferPhonePe && params.phonePeConfig) {
    return params.phonePeConfig.environment;
  }

  return "sandbox";
}
