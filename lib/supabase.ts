import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient as createBrowserClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export const createClient = () => {
  const cookieStore = cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch (error) {
            // Handle cookie setting in Server Components
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch (error) {
            // Handle cookie removal in Server Components
          }
        },
      },
    }
  )
}

export const createBrowserSupabaseClient = () => {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export const createServiceClient = () => {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Database types
export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          name: string | null
          stripe_customer_id: string | null
          created_at: string
        }
        Insert: {
          id: string
          email: string
          name?: string | null
          stripe_customer_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string | null
          stripe_customer_id?: string | null
          created_at?: string
        }
      }
      projects: {
        Row: {
          id: string
          user_id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          created_at?: string
        }
      }
      uploads: {
        Row: {
          id: string
          project_id: string
          filename: string
          size_bytes: number
          storage_url: string
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          filename: string
          size_bytes: number
          storage_url: string
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          filename?: string
          size_bytes?: number
          storage_url?: string
          created_at?: string
        }
      }
      jobs: {
        Row: {
          id: string
          project_id: string
          upload_id: string
          status: 'queued' | 'processing' | 'done' | 'failed'
          params: any
          result_tif_url: string | null
          result_png_url: string | null
          result_csv_url: string | null
          logs: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          upload_id: string
          status?: 'queued' | 'processing' | 'done' | 'failed'
          params?: any
          result_tif_url?: string | null
          result_png_url?: string | null
          result_csv_url?: string | null
          logs?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          upload_id?: string
          status?: 'queued' | 'processing' | 'done' | 'failed'
          params?: any
          result_tif_url?: string | null
          result_png_url?: string | null
          result_csv_url?: string | null
          logs?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      usage_counters: {
        Row: {
          user_id: string
          month: string
          jobs_used: number
          storage_used_bytes: number
        }
        Insert: {
          user_id: string
          month: string
          jobs_used?: number
          storage_used_bytes?: number
        }
        Update: {
          user_id?: string
          month?: string
          jobs_used?: number
          storage_used_bytes?: number
        }
      }
    }
  }
}
