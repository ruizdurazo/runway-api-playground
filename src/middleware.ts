import { NextResponse, type NextRequest } from "next/server"
import { createSupabaseServerClient } from "./lib/supabaseServer"

export async function middleware(req: NextRequest) {
  const supabase = createSupabaseServerClient(req)
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const pathname = req.nextUrl.pathname

  if (!session && pathname.startsWith("/dashboard")) {
    const redirectUrl = new URL("/login", req.url)
    return NextResponse.redirect(redirectUrl)
  }

  if (session && (pathname === "/" || pathname === "/login")) {
    const redirectUrl = new URL("/dashboard", req.url)
    return NextResponse.redirect(redirectUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/", "/login", "/dashboard/:path*", "/auth/callback"],
}
