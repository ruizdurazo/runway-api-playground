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

    // Remove `gen3a_turbo`, `gemini_2.5_flash`, and `veo3` from organization details
    if (details) {
      Object.keys(details.tier.models).forEach((model: string) => {
        if (model === "gen3a_turbo") {
          delete details.tier.models[model]
        }
        if (model === "gemini_2.5_flash") {
          // @ts-expect-error - Type mismatch
          delete details.tier.models[model]
        }
        if (model === "veo3") {
          // @ts-expect-error - Type mismatch
          delete details.tier.models[model]
        }
      })
      Object.keys(details.usage.models).forEach((model: string) => {
        if (model === "gen3a_turbo") {
          delete details.usage.models[model]
        }
        if (model === "gemini_2.5_flash") {
          // @ts-expect-error - Type mismatch
          delete details.usage.models[model]
        }
        if (model === "veo3") {
          // @ts-expect-error - Type mismatch
          delete details.usage.models[model]
        }
      })
    }

    // Remove `gen3a_turbo`, `gemini_2.5_flash`, and `veo3` from usage
    if (usage) {
      usage.results.forEach(
        (result: { usedCredits: { model: string; amount: number }[] }) => {
          result.usedCredits = result.usedCredits.filter(
            (item: { model: string }) =>
              item.model !== "gen3a_turbo" && item.model !== "gemini_2.5_flash" && item.model !== "veo3",
          )
        },
      )
      usage.models = usage.models.filter(
        (model: string) => model !== "gen3a_turbo" && model !== "gemini_2.5_flash" && model !== "veo3",
      )
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
