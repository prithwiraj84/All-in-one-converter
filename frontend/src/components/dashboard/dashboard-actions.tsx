"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Manual refresh button. The dashboard is server-rendered, so `router.refresh()`
 * re-runs the server data fetch and swaps in fresh files/conversions/usage
 * without a full page reload or losing scroll position.
 */
export function RefreshButton({ className }: { className?: string }) {
  const router = useRouter();
  const [spinning, setSpinning] = React.useState(false);

  function onClick() {
    setSpinning(true);
    router.refresh();
    window.setTimeout(() => setSpinning(false), 700);
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      className={cn("shrink-0", className)}
    >
      <RefreshCw className={cn("h-4 w-4", spinning && "animate-spin")} />
      Refresh
    </Button>
  );
}

/**
 * Invisible component that keeps the dashboard live: refreshes server data when
 * the tab regains focus, on a slow interval, and (best-effort) on Supabase
 * realtime changes to the user's files/conversions. Realtime is optional — if
 * it isn't enabled on the project, the focus/interval refresh still keeps things
 * current. Renders nothing.
 */
export function DashboardAutoRefresh({ intervalMs = 45_000 }: { intervalMs?: number }) {
  const router = useRouter();

  React.useEffect(() => {
    let last = Date.now();
    const refresh = () => {
      last = Date.now();
      router.refresh();
    };
    const onFocus = () => {
      // Avoid a double refresh when focus + visibility fire together.
      if (Date.now() - last > 4000) refresh();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") onFocus();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, intervalMs);

    // Best-effort live updates via Supabase realtime.
    let supabase: ReturnType<typeof createClient> | null = null;
    let channel: RealtimeChannel | null = null;
    if (isSupabaseConfigured()) {
      try {
        supabase = createClient();
        channel = supabase
          .channel("dashboard-live")
          .on("postgres_changes", { event: "*", schema: "public", table: "files" }, refresh)
          .on("postgres_changes", { event: "*", schema: "public", table: "conversions" }, refresh)
          .subscribe();
      } catch {
        /* realtime is optional; the interval/focus refresh covers it */
      }
    }

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(intervalId);
      if (supabase && channel) {
        try {
          supabase.removeChannel(channel);
        } catch {
          /* ignore */
        }
      }
    };
  }, [router, intervalMs]);

  return null;
}

/**
 * Deletes a file record (RLS scopes the delete to the owner), then refreshes.
 * The underlying processed file auto-deletes on the backend after 60 minutes;
 * this removes the row from the user's history immediately.
 */
export function DeleteFileButton({ fileId, filename }: { fileId: string; filename: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function onDelete() {
    if (!isSupabaseConfigured() || busy) return;
    setBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("files").delete().eq("id", fileId);
      if (error) throw error;
      toast.success("File removed");
      router.refresh();
    } catch {
      toast.error("Couldn't remove the file. Please try again.");
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
      onClick={onDelete}
      disabled={busy}
      aria-label={`Delete ${filename}`}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
    </Button>
  );
}
