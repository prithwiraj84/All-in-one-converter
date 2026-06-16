"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useUser } from "./use-user";
import { createClient } from "@/lib/supabase/client";
import { createOrder, verifyPayment, type RazorpayResult } from "@/lib/payments";

interface RazorpayInstance {
  open: () => void;
  on: (event: string, handler: (resp: unknown) => void) => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${CHECKOUT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(true));
      existing.addEventListener("error", () => resolve(false));
      return;
    }
    const script = document.createElement("script");
    script.src = CHECKOUT_SRC;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

/**
 * Drives the Razorpay upgrade flow: create order → Checkout widget → verify →
 * grant plan. Signed-out users are sent to login first.
 */
export function useUpgrade() {
  const { user } = useUser();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const upgrade = useCallback(
    async (plan = "pro") => {
      if (loading) return;
      if (!user) {
        router.push("/login?redirectedFrom=/dashboard");
        return;
      }
      setLoading(true);
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) {
          router.push("/login?redirectedFrom=/dashboard");
          return;
        }

        const order = await createOrder(plan, token);
        const ready = await loadRazorpay();
        if (!ready || !window.Razorpay) {
          throw new Error("Couldn't load the payment window. Check your connection and try again.");
        }

        const rzp = new window.Razorpay({
          key: order.key_id,
          amount: order.amount,
          currency: order.currency,
          order_id: order.order_id,
          name: "All in one converter",
          description: `${plan.charAt(0).toUpperCase() + plan.slice(1)} plan`,
          prefill: { email: order.email ?? user.email ?? undefined },
          theme: { color: "#2563EB" },
          handler: async (resp: unknown) => {
            const r = resp as RazorpayResult;
            try {
              await verifyPayment(plan, r, token);
              toast.success("You're on Pro now! 🎉 Enjoy the upgrade.");
              router.refresh();
              window.setTimeout(() => window.location.reload(), 1200);
            } catch (err) {
              toast.error(
                (err as Error).message ||
                  "We couldn't confirm the payment. If you were charged, contact support — it'll be applied shortly.",
              );
            }
          },
        });
        rzp.on("payment.failed", () => toast.error("Payment failed or was cancelled."));
        rzp.open();
      } catch (err) {
        toast.error((err as Error).message || "Something went wrong starting checkout.");
      } finally {
        setLoading(false);
      }
    },
    [user, router, loading],
  );

  return { upgrade, loading };
}
