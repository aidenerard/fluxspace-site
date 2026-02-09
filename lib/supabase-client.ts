import { createClient as createBrowserClient } from '@supabase/supabase-js'

/**
 * Create a Supabase client for use in Client Components
 * This should only be used in "use client" components
 */
export const createBrowserSupabaseClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable')
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable. Please check your .env.local file.')
  }
  if (!supabaseAnonKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable')
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable. Please check your .env.local file.')
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}
