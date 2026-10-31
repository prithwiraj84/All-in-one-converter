import { API_BASE } from "./api";

export interface CreateOrderResponse {
  order_id: string;
  amount: number;
  currency: string;
  key_id: string;
  plan: string;
  email?: string | null;
}

export interface RazorpayResult {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

async function detail(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { detail?: string };
    return body.detail || fallback;
  } catch {
    return fallback;
  }
}

export interface PaymentConfig {
  enabled: boolean;
  /** Backend opted into free test upgrades (PAYMENTS_DEV_MODE, no Razorpay keys). */
  dev_mode?: boolean;
  currency?: string;
  period_days?: number;
}

/** Is Razorpay checkout configured on the backend? */
export async function getPaymentConfig(): Promise<PaymentConfig> {
  try {
    const res = await fetch(`${API_BASE}/api/payments/config`);
    if (!res.ok) return { enabled: false };
    return res.json();
  } catch {
    return { enabled: false };
  }
}

/** Dev-only: grant the plan without payment (only when the backend reports dev_mode). */
export async function devUpgrade(plan: string, token: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/payments/dev-upgrade`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ plan }),
  });
  if (!res.ok) throw new Error(await detail(res, "Couldn't unlock the plan."));
}

/** Ask the backend to create a Razorpay order for a plan. */
export async function createOrder(plan: string, token: string): Promise<CreateOrderResponse> {
  const res = await fetch(`${API_BASE}/api/payments/create-order`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ plan }),
  });
  if (!res.ok) throw new Error(await detail(res, "Couldn't start checkout."));
  return res.json();
}

/** Verify the Razorpay payment server-side, which grants the plan. */
export async function verifyPayment(
  plan: string,
  result: RazorpayResult,
  token: string,
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/payments/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ plan, ...result }),
  });
  if (!res.ok) throw new Error(await detail(res, "Payment verification failed."));
}
