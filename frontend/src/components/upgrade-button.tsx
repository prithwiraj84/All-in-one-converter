"use client";

import { Loader2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { useUpgrade } from "@/hooks/use-upgrade";

interface UpgradeButtonProps extends Omit<ButtonProps, "onClick" | "asChild"> {
  /** Plan to buy or renew through Razorpay checkout. */
  plan?: string;
}

/** Opens Razorpay checkout for `plan` (signed-out users are sent to login first). */
export function UpgradeButton({ plan = "pro", children, disabled, ...props }: UpgradeButtonProps) {
  const { upgrade, loading } = useUpgrade();
  return (
    <Button type="button" onClick={() => upgrade(plan)} disabled={disabled || loading} {...props}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </Button>
  );
}
