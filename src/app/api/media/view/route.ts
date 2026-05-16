import { createSupabaseServerClient } from "@/lib/supabaseServer"
import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get("path")
  if (!path || path.includes("..") || path.startsWith("/")) {
    return NextResponse.json({ message: "Invalid path" }, { status: 400 })
  }

  const supabase = createSupabaseServerClient(request)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const prefix = `${user.id}/`
  if (!path.startsWith(prefix)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 })
  }

  const { data: signed, error: signError } = await supabase.storage
    .from("media")
    .createSignedUrl(path, 3600)

  if (signError || !signed?.signedUrl) {
    return NextResponse.json(
      { message: signError?.message ?? "Could not sign URL" },
      { status: 404 },
    )
  }

  const upstream = await fetch(signed.signedUrl)
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json(
      { message: "Failed to load from storage" },
      { status: 502 },
    )
  }

  const contentType =
    upstream.headers.get("content-type") ?? "application/octet-stream"

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=60",
    },
  })
}
