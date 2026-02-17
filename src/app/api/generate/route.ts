import { createSupabaseServerClient } from "@/lib/supabaseServer"
import RunwayML, { TaskFailedError } from "@runwayml/sdk"
import { NextRequest, NextResponse } from "next/server"
import { resolveModel, getModelById } from "@/lib/models/registry"
import { validateModelInputs } from "@/lib/models/validation"
import { getStrategy } from "./strategies"

export async function POST(request: NextRequest) {
  // ---- Auth ----------------------------------------------------------------
  const supabase = createSupabaseServerClient(request)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const apiKey = user.user_metadata?.runway_api_key
  if (!apiKey) {
    return NextResponse.json(
      { message: "Runway API key not set in settings" },
      { status: 400 },
    )
  }

  // ---- Parse request -------------------------------------------------------
  const body = await request.json()
  const { promptId, model: rawModel, generationType, assets, ratio } = body

  if (!promptId || !rawModel || !generationType) {
    return NextResponse.json(
      { message: "Missing required parameters" },
      { status: 400 },
    )
  }

  // ---- Resolve model -------------------------------------------------------
  let model: string
  try {
    model = resolveModel(rawModel)
  } catch {
    return NextResponse.json(
      { message: `Unknown model: ${rawModel}` },
      { status: 400 },
    )
  }
  const modelDef = getModelById(model as Parameters<typeof getModelById>[0])

  // ---- Fetch prompt text ---------------------------------------------------
  const { data: prompt, error: promptError } = await supabase
    .from("prompts")
    .select("prompt_text")
    .eq("id", promptId)
    .single()

  if (promptError || !prompt) {
    return NextResponse.json({ message: "Prompt not found" }, { status: 404 })
  }

  // ---- Fetch input media for validation ------------------------------------
  const { data: media } = await supabase
    .from("media")
    .select("*")
    .eq("prompt_id", promptId)
    .eq("category", "input")

  const positionsRequired =
    modelDef.inputs.kind === "standard" && modelDef.inputs.positionsRequired
  const inputs =
    media?.map((m) => ({
      type: (m.type ?? "image") as "image" | "video",
      url: m.url || "",
      tag: m.tag,
      ...(positionsRequired ? { position: "first" as const } : {}),
    })) || []

  // ---- Validate ------------------------------------------------------------
  try {
    validateModelInputs(model, generationType, prompt.prompt_text, inputs, ratio)
  } catch (err) {
    return NextResponse.json(
      { message: (err as Error).message },
      { status: 400 },
    )
  }

  // ---- Determine strategy --------------------------------------------------
  // If no assets provided and model has a text-only endpoint, use that instead
  const hasAssets = assets && assets.length > 0
  const endpoint =
    !hasAssets && modelDef.textOnlyEndpoint
      ? modelDef.textOnlyEndpoint
      : modelDef.endpoint

  const strategy = getStrategy(endpoint)

  // ---- Execute strategy ----------------------------------------------------
  try {
    const client = new RunwayML({ apiKey })
    const result = await strategy.execute({
      client,
      model,
      promptText: prompt.prompt_text,
      assets: assets || [],
      ratio,
      additionalParams: modelDef.additionalParams
        ? Object.fromEntries(
            Object.entries(modelDef.additionalParams).map(([k, v]) => [
              k,
              v.default,
            ]),
          )
        : undefined,
    })

    // ---- Post-processing: save output to Supabase --------------------------
    const mediaResponse = await fetch(result.url)
    if (!mediaResponse.ok) throw new Error("Failed to fetch generated media")

    const mediaBlob = await mediaResponse.blob()
    const ext = result.mediaType === "image" ? "jpg" : "mp4"
    const filename = `${promptId}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from("media")
      .upload(`${user.id}/${filename}`, mediaBlob, {
        contentType: result.mediaType === "image" ? "image/jpeg" : "video/mp4",
      })

    if (uploadError) throw uploadError

    const path = `${user.id}/${filename}`

    const { error: insertError } = await supabase.from("media").insert({
      prompt_id: promptId,
      path,
      type: result.mediaType,
      category: "output",
      user_id: user.id,
    })

    if (insertError) throw insertError

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error(error)
    if (error instanceof TaskFailedError) {
      return NextResponse.json(
        { message: "Generation failed: " + JSON.stringify(error.taskDetails) },
        { status: 500 },
      )
    }
    if (error instanceof Error) {
      return NextResponse.json(
        { message: error.message || "Internal server error" },
        { status: 500 },
      )
    }
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    )
  }
}
