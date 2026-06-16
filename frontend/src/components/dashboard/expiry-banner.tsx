"use client";

import * as React from "react";
import { TriangleAlert, X } from "lucide-react";
import { UpgradeButton } from "@/components/upgrade-button";

const DISMISS_KEY = "pro-expiry-dismissed";

/**
 * Warning shown on the dashboard when a Pro plan is close to lapsing. Dismissible
 * for the session (returns on the next visit) so it nudges without nagging.
 */
export function ExpiryBanner({
  daysLeft,
  expiryLabel,
}: {
  daysLeft: number;
  expiryLabel: string | null;
}) {
  const [dismissed, setDismissed] = React.useState(true); // hidden until we've checked

  React.useEffect(() => {
    setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  if (dismissed) return null;

  const when = daysLeft <= 0 ? "today" : daysLeft === 1 ? "tomorrow" : `in ${daysLeft} days`;

  return (
    <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-amber-300/70 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-600">
          <TriangleAlert className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm font-semibold text-amber-900">Your Pro plan expires {when}</p>
          <p className="text-xs text-amber-700">
            {expiryLabel ? `Ends on ${expiryLabel}. ` : ""}Renew now to keep your Pro limits.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 self-end sm:self-auto">
        <UpgradeButton variant="gradient" size="sm">
          Renew Pro
        </UpgradeButton>
        <button
          type="button"
          onClick={() => {
            sessionStorage.setItem(DISMISS_KEY, "1");
            setDismissed(true);
          }}
          aria-label="Dismiss"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-amber-700/70 transition-colors hover:bg-amber-100 hover:text-amber-900"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
