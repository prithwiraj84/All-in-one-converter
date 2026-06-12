import { createClient } from "@/lib/supabase/server";
import { getDashboardData, emptyDashboardData, type DashboardData } from "@/lib/dashboard-data";
import {
  DashboardOverview,
  FilesView,
  ConversionsView,
  SettingsView,
} from "@/components/dashboard/dashboard-views";

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

  switch (tab) {
    case "files":
      return <FilesView data={data} />;
    case "conversions":
      return <ConversionsView data={data} />;
    case "settings":
    case "account":
      return <SettingsView data={data} />;
    default:
      return <DashboardOverview data={data} />;
  }
}
