import { createSupabaseServerClient } from "@/lib/supabaseServer"
import RunwayML, { TaskFailedError } from "@runwayml/sdk"
import { NextRequest, NextResponse } from "next/server"
import {
  getModelById,
  getStrategy,
  mergeAdditionalParams,
  resolveModel,
  validateModelInputs,
} from "@runway-playground/shared"

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
  const {
    promptId,
    model: rawModel,
    generationType,
    assets,
    ratio,
    additionalParams: additionalOverrides,
  } = body as {
    promptId?: string
    model?: string
    generationType?: string
    assets?: { url: string; tag?: string; position?: "first" | "last" }[]
    ratio?: string
    additionalParams?: Record<string, unknown>
  }

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
    media?.map((m) => {
      const pos =
        m.position === "last"
          ? ("last" as const)
          : m.position === "first"
            ? ("first" as const)
            : ("first" as const)
      return {
        type: (m.type ?? "image") as "image" | "video",
        url: (m as { url?: string }).url || "",
        tag: m.tag,
        ...(positionsRequired ? { position: pos } : {}),
      }
    }) || []

  const hasAssets = Array.isArray(assets) && assets.length > 0
  const usingTextOnlyEndpoint =
    !hasAssets && Boolean(modelDef.textOnlyEndpoint)

  const mergedAdditional = mergeAdditionalParams(model, additionalOverrides ?? null)

  // ---- Validate ------------------------------------------------------------
  try {
    validateModelInputs(
      model,
      generationType as "image" | "video",
      prompt.prompt_text,
      inputs,
      ratio ?? "",
      mergedAdditional,
      { usingTextOnlyEndpoint },
    )
  } catch (err) {
    return NextResponse.json(
      { message: (err as Error).message },
      { status: 400 },
    )
  }

  // ---- Determine strategy --------------------------------------------------
  const endpoint =
    usingTextOnlyEndpoint && modelDef.textOnlyEndpoint
      ? modelDef.textOnlyEndpoint
      : modelDef.endpoint

  const strategy = getStrategy(endpoint)

  // ---- Execute strategy ----------------------------------------------------
  try {
    const client = new RunwayML({ apiKey })
    const strategyAssets = (assets ?? []).map((a) => ({
      url: a.url,
      tag: a.tag ?? "",
      ...(a.position ? { position: a.position } : {}),
    }))

    const result = await strategy.execute({
      client,
      model,
      promptText: prompt.prompt_text,
      assets: strategyAssets,
      ratio,
      additionalParams: mergedAdditional,
    })

    // ---- Post-processing: clean old outputs, then save new one ---------------
    const { data: oldOutputs } = await supabase
      .from("media")
      .select("id, path")
      .eq("prompt_id", promptId)
      .eq("category", "output")

    for (const out of oldOutputs ?? []) {
      await supabase.storage.from("media").remove([out.path])
      await supabase.from("media").delete().eq("id", out.id)
    }

    const mediaResponse = await fetch(result.url)
    if (!mediaResponse.ok) throw new Error("Failed to fetch generated media")

    const mediaBlob = await mediaResponse.blob()
    const ext = result.mediaType === "image" ? "jpg" : "mp4"
    const filename = `${promptId}-${Date.now()}.${ext}`

    const path = `${user.id}/${filename}`
    const { error: uploadError } = await supabase.storage
      .from("media")
      .upload(path, mediaBlob, {
        contentType: result.mediaType === "image" ? "image/jpeg" : "video/mp4",
      })

    if (uploadError) throw uploadError

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
