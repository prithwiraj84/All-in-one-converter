"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Loader2 } from "lucide-react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SignOutButtonProps {
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
  label?: string;
}

/** Signs the user out of Supabase and returns them to the landing page. */
export function SignOutButton({
  variant = "outline",
  size = "default",
  className,
  label = "Sign out",
}: SignOutButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function signOut() {
    setLoading(true);
    try {
      if (isSupabaseConfigured()) await createClient().auth.signOut();
    } catch {
      /* ignore — fall through to redirect */
    }
    router.push("/");
    router.refresh();
  }

  return (
    <Button
      variant={variant}
      size={size}
      className={cn(className)}
      onClick={signOut}
      disabled={loading}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
      {label}
    </Button>
  );
}
