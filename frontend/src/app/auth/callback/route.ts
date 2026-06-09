import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * OAuth / magic-link callback handler.
 *
 * Supabase redirects here with a `code` query param after the user
 * authenticates. We exchange that code for a session (setting the auth
 * cookies) and then forward the user to `next` (default `/dashboard`).
 * Any failure sends the user back to `/login?error=auth`.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(origin + next);
    }
  }

  return NextResponse.redirect(origin + "/login?error=auth");
}
