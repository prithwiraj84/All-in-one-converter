import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client. Safe to use in client components.
 * Reads public env vars only (anon key).
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
