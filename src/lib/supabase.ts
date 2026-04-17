import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"

let browserClient: SupabaseClient | undefined

function getBrowserClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error(
      "@supabase/ssr: Your project's URL and API key are required to create a Supabase client!\n\n" +
        "Check your Supabase project's API settings to find these values\n\n" +
        "https://supabase.com/dashboard/project/_/settings/api",
    )
  }
  if (!browserClient) {
    browserClient = createBrowserClient(url, key)
  }
  return browserClient
}

/**
 * Lazy browser client so `next build` can prerender routes that import this
 * module without `NEXT_PUBLIC_SUPABASE_*` (e.g. Docker / CI without secrets).
 * The real client is created on first use (browser or SSR when handlers run).
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const client = getBrowserClient()
    const value = Reflect.get(client, prop, receiver) as unknown
    if (typeof value === "function") {
      return (value as (...args: unknown[]) => unknown).bind(client)
    }
    return value
  },
}) as SupabaseClient
