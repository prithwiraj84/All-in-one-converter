import { createClient } from "@/lib/supabase/server";
import { getDashboardData, emptyDashboardData, type DashboardData } from "@/lib/dashboard-data";
import {
  DashboardOverview,
  FilesView,
  ConversionsView,
  SettingsView,
} from "@/components/dashboard/dashboard-views";
import { DashboardAutoRefresh } from "@/components/dashboard/dashboard-actions";
import { ExpiryBanner } from "@/components/dashboard/expiry-banner";
import { ApiKeysView } from "@/components/dashboard/api-keys-view";
import { TeamView } from "@/components/dashboard/team-view";
import { subscriptionStatus } from "@/lib/subscription";

// Auth-gated, per-user data (reads cookies) — never prerender this route.
export const dynamic = "force-dynamic";

async function loadData(): Promise<DashboardData> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return await getDashboardData(supabase, user);
  } catch {
    // Supabase env may be missing during build — render a safe empty dashboard.
    return emptyDashboardData();
  }
}

export default async function DashboardHome({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const data = await loadData();

  const view = (() => {
    switch (tab) {
      case "files":
        return <FilesView data={data} />;
      case "conversions":
        return <ConversionsView data={data} />;
      case "settings":
      case "account":
        return <SettingsView data={data} />;
      case "api":
        return <ApiKeysView />;
      case "team":
        return <TeamView />;
      default:
        return <DashboardOverview data={data} />;
    }
  })();

  const sub = subscriptionStatus(data.plan, data.proUntil);
  const showExpiryWarning = sub.isPaid && sub.daysLeft != null && sub.daysLeft <= 5;

  return (
    <>
      {/* Keeps files/conversions/usage live (focus + interval + realtime). */}
      {data.loggedIn && <DashboardAutoRefresh />}
      {showExpiryWarning && (
        <ExpiryBanner plan={data.plan} daysLeft={sub.daysLeft!} expiryLabel={sub.expiryLabel} />
      )}
      {view}
    </>
  );
}
