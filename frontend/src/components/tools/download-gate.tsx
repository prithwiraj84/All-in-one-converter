"use client";

import { Lock } from "lucide-react";
import { SocialButtons } from "@/components/auth/social-buttons";
import { setPendingDownload, type PendingDownload } from "@/lib/pending-download";

/**
 * Shown when an anonymous user has a processed file ready. Tools are free to
 * try, but downloading requires an account. We stash the pending download
 * before the OAuth redirect so the file is still offered when they return.
 */
export function DownloadGate({
  pending,
  redirectTo,
}: {
  /** Server results stash a pending download to restore after sign-in; in-browser
   * (blob) results pass null since they can't survive the redirect. */
  pending?: PendingDownload | null;
  redirectTo: string;
}) {
  return (
    <div className="rounded-xl border-2 border-dashed border-primary/30 bg-primary/[0.03] p-5">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-fun-gradient text-white shadow-glow">
          <Lock className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-bold leading-tight">Your file is ready! 🎉</p>
          <p className="text-xs text-muted-foreground">
            Sign in free to download — it keeps your results safe and lets you pick up where you
            left off.
          </p>
        </div>
      </div>
      <SocialButtons
        redirectTo={redirectTo}
        onBeforeRedirect={() => {
          if (pending) setPendingDownload(pending);
        }}
      />
    </div>
  );
}
