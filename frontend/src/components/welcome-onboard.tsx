"use client";

import { useEffect } from "react";
import { useUser } from "@/hooks/use-user";
import { createClient } from "@/lib/supabase/client";
import { API_BASE } from "@/lib/api";

/**
 * Fires the one-time welcome email for a signed-in user. Called once per session
 * (sessionStorage guard); the backend only actually sends it once ever
 * (profiles.welcomed_at), so this is safe on every login / page load.
 */
export function WelcomeOnboard() {
  const { user, loading } = useUser();

  useEffect(() => {
    if (loading || !user || typeof window === "undefined") return;
    if (sessionStorage.getItem("aio-welcome-checked")) return;
    sessionStorage.setItem("aio-welcome-checked", "1");
    (async () => {
      try {
        const { data } = await createClient().auth.getSession();
        const token = data.session?.access_token;
        if (!token) return;
        await fetch(`${API_BASE}/api/me/welcome`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        /* best-effort — never block the UI */
      }
    })();
  }, [user, loading]);

  return null;
}
