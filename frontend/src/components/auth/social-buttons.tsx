"use client";

import { useState } from "react";
import { Github, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

type OAuthProvider = "google" | "github";

interface SocialButtonsProps {
  /** Optional path appended as a `next` query param to the OAuth callback. */
  redirectTo?: string;
  /** Runs right before the browser hands off to the provider — e.g. to stash state. */
  onBeforeRedirect?: () => void;
}

function GoogleGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.82-.07-1.6-.21-2.36H12v4.46h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.72Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3a7.2 7.2 0 0 1-4.06 1.15 7.14 7.14 0 0 1-6.71-4.94H1.28v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.29 14.3a7.18 7.18 0 0 1 0-4.6V6.62H1.28a12 12 0 0 0 0 10.78l4.01-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44A11.96 11.96 0 0 0 12 0 12 12 0 0 0 1.28 6.62l4.01 3.08A7.14 7.14 0 0 1 12 4.75Z"
      />
    </svg>
  );
}

export function SocialButtons({ redirectTo, onBeforeRedirect }: SocialButtonsProps) {
  const [loading, setLoading] = useState<OAuthProvider | null>(null);

  async function handleOAuth(provider: OAuthProvider) {
    if (!isSupabaseConfigured()) {
      toast.error("Login isn't configured yet. Add your Supabase keys and enable this provider.");
      return;
    }
    setLoading(provider);
    try {
      onBeforeRedirect?.();
      const supabase = createClient();
      const callback = new URL("/auth/callback", window.location.origin);
      if (redirectTo) callback.searchParams.set("next", redirectTo);

      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: callback.toString() },
      });

      if (error) {
        toast.error(error.message);
        setLoading(null);
      }
      // On success the browser redirects to the provider — keep the spinner.
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full"
        disabled={loading !== null}
        onClick={() => handleOAuth("google")}
      >
        {loading === "google" ? (
          <Loader2 className="animate-spin" />
        ) : (
          <GoogleGlyph className="h-4 w-4" />
        )}
        Continue with Google
      </Button>

      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full"
        disabled={loading !== null}
        onClick={() => handleOAuth("github")}
      >
        {loading === "github" ? <Loader2 className="animate-spin" /> : <Github />}
        Continue with GitHub
      </Button>
    </div>
  );
}
