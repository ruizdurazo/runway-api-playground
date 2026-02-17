import { NextResponse, type NextRequest } from "next/server"
import { createSupabaseServerClient } from "./lib/supabaseServer"

export async function middleware(req: NextRequest) {
  const supabase = createSupabaseServerClient(req)
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session && req.nextUrl.pathname.startsWith("/dashboard")) {
    const redirectUrl = new URL("/login", req.url)
    return NextResponse.redirect(redirectUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/dashboard/:path*", "/auth/callback"],
}
