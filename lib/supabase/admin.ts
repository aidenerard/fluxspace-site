import "server-only"
import { createClient } from "@supabase/supabase-js"

/**
 * Supabase client using the service-role key.
 * Bypasses RLS — use only in API routes and server components.
 * NEVER import this file from a "use client" module.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    )
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
