import type { Metadata } from "next";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export const metadata: Metadata = {
  title: "Dashboard",
};

type DashboardUser = {
  email?: string;
  name?: string;
  avatar?: string;
};

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  let user: DashboardUser = {};

  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    user = {
      email: authUser?.email,
      name: authUser?.user_metadata?.full_name,
      avatar: authUser?.user_metadata?.avatar_url,
    };
  } catch {
    // Supabase env may be missing during build — render with an empty user
    // so the dashboard never crashes.
    user = {};
  }

  return <DashboardShell user={user}>{children}</DashboardShell>;
}
