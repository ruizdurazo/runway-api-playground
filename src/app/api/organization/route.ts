import RunwayML from "@runwayml/sdk"
import { createSupabaseServerClient } from "@/lib/supabaseServer"
import { NextRequest } from "next/server"

export async function GET(request: NextRequest) {
  const supabase = createSupabaseServerClient(request)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    })
  }

  const apiKey = user.user_metadata?.runway_api_key

  if (!apiKey) {
    return new Response(JSON.stringify({ error: "No API key set" }), {
      status: 400,
    })
  }

  const client = new RunwayML({ apiKey })

  // Get start and end date from query params
  const { searchParams } = new URL(request.url)
  const startDate =
    searchParams.get("startDate") ||
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] // 30 days ago
  const endDate =
    searchParams.get("endDate") ||
    new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0] // tomorrow

  try {
    const details = await client.organization.retrieve()
    let usage = null
    if (startDate || endDate) {
      usage = await client.organization.retrieveUsage({
        startDate: startDate,
        beforeDate: endDate,
      })
    }

    // Return organization and usage
    return new Response(JSON.stringify({ organization: details, usage }), {
      status: 200,
    })
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500 },
    )
  }
}
