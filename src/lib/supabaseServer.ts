import { createServerClient } from "@supabase/ssr"
import { NextRequest } from "next/server"

export function createSupabaseServerClient(request: NextRequest) {
  const cookieStore = request.cookies
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value }) =>
              cookieStore.set(name, value),
            )
          } catch {
            // Ignore if called from Server Component
          }
        },
      },
    },
  )
}
