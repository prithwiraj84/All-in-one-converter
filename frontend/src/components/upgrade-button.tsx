"use client";

import { Loader2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { useUpgrade } from "@/hooks/use-upgrade";

interface UpgradeButtonProps extends Omit<ButtonProps, "onClick" | "asChild"> {
  /** Plan to purchase. Defaults to "pro". */
  plan?: string;
}

/** Button that opens Razorpay Checkout to upgrade the signed-in user. */
export function UpgradeButton({ plan = "pro", children, disabled, ...props }: UpgradeButtonProps) {
  const { upgrade, loading } = useUpgrade();
  return (
    <Button type="button" onClick={() => upgrade(plan)} disabled={disabled || loading} {...props}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {children}
    </Button>
  );
}
