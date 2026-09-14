/**
 * The browser's Supabase client, used for sign-in and for the Signer's own rows, which are reached
 * under row-level security with the public anon key. No service key exists anywhere in this app.
 *
 * Accounts are optional for the app to run: with either variable absent there is no client at all,
 * never a stand-in, and the screens that need an account say accounts are not set up. Nothing here
 * runs at import time.
 */
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

// Read with their literal names so Next.js inlines them into the browser bundle.
function readConfig(): { url: string; anonKey: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || url.trim() === "" || !anonKey || anonKey.trim() === "") return null;
  return { url, anonKey };
}

/** True when both Supabase variables are set. Cheap, and safe to call while rendering on the server. */
export function isSupabaseConfigured(): boolean {
  return readConfig() !== null;
}

let cached: { url: string; anonKey: string; client: SupabaseClient } | null = null;

/**
 * The one browser client, or `null` when either variable is missing. Call it from effects and event
 * handlers, not while rendering on the server.
 *
 * PKCE flow: the one-time link returns with a `code`, which the client exchanges for a session on
 * its own when it starts on the page the link opens (`detectSessionInUrl`).
 */
export function getSupabaseClient(): SupabaseClient | null {
  const config = readConfig();
  if (!config) return null;
  if (cached && cached.url === config.url && cached.anonKey === config.anonKey) return cached.client;
  const client = createClient(config.url, config.anonKey, {
    auth: { flowType: "pkce", detectSessionInUrl: true, persistSession: true, autoRefreshToken: true },
  });
  cached = { ...config, client };
  return client;
}
