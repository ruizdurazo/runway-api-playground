import { createSupabaseServerClient } from "@/lib/supabaseServer"
import RunwayML, { TaskFailedError } from "@runwayml/sdk"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
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

  const body = await request.json()
  const { promptId, model, generationType, assets, ratio = "1280:720" } = body

  if (!promptId || !model || !generationType) {
    return NextResponse.json(
      { message: "Missing required parameters" },
      { status: 400 },
    )
  }

  // Fetch prompt
  const { data: prompt, error: promptError } = await supabase
    .from("prompts")
    .select("prompt_text")
    .eq("id", promptId)
    .single()

  if (promptError || !prompt) {
    return NextResponse.json({ message: "Prompt not found" }, { status: 404 })
  }

  const client = new RunwayML({ apiKey })

  const parameters = {
    model,
    promptText: prompt.prompt_text,
    referenceImages:
      assets?.map((a: { url: string; tag: string }, index: number) => ({
        uri: a.url,
        tag: a.tag || `ref${index + 1}`,
      })) || [],
    ratio,
  }

  try {
    let effectiveGenerationType = generationType
    let url
    if (model === "upscale_v1") {
      if (!assets || assets.length !== 1) {
        throw new Error("Upscale requires exactly one video input")
      }
    } else if (assets?.length > 3) {
      throw new Error("Maximum of 3 reference images allowed")
    }
    if (model === "upscale_v1") {
      const videoParams = {
        model: "upscale_v1",
        videoUri: assets[0].url,
      }
      const task = await client.videoUpscale
        // @ts-expect-error - Model type mismatch
        .create(videoParams)
        .waitForTaskOutput()
      url = task.output?.[0]
      effectiveGenerationType = "video"
    } else if (generationType === "image") {
      let effectiveModel = model
      let refImages =
        assets?.map((a: { url: string; tag: string }, index: number) => ({
          uri: a.url,
          tag: a.tag || `ref${index + 1}`,
        })) || []
      if (model === "gen4_image" && refImages.length > 0) {
        effectiveModel = "gen4_image_turbo"
      }
      const params = {
        model: effectiveModel,
        promptText: prompt.prompt_text,
        ratio,
        contentModeration: { publicFigureThreshold: "low" },
      }
      if (refImages.length > 0) {
        // @ts-expect-error - Type mismatch
        params.referenceImages = refImages
      }
      const task = await client.textToImage
        // @ts-expect-error - Model type mismatch
        .create(params)
        .waitForTaskOutput()
      url = task.output?.[0]
    } else {
      const imageParams = {
        model: "gen4_image_turbo",
        promptText: parameters.promptText,
        referenceImages:
          assets?.map((a: { url: string; tag: string }, index: number) => ({
            uri: a.url,
            tag: a.tag || `ref${index + 1}`,
          })) || [],
        ratio,
      }
      const imageTask = await client.textToImage
        // @ts-expect-error - Model type mismatch
        .create(imageParams)
        .waitForTaskOutput()
      const imageUrl = imageTask.output?.[0]
      if (!imageUrl) throw new Error("No image URL")

      const videoParams = {
        model: parameters.model,
        promptImage: imageUrl,
        promptText: parameters.promptText,
        ratio,
        duration: model === "veo3" ? 8 : 5,
      }
      const videoTask = await client.imageToVideo
        // @ts-expect-error - Model type mismatch
        .create(videoParams)
        .waitForTaskOutput()
      url = videoTask.output?.[0]
    }
    if (!url) throw new Error("No output URL")

    const mediaResponse = await fetch(url)
    if (!mediaResponse.ok) throw new Error("Failed to fetch generated media")

    const mediaBlob = await mediaResponse.blob()

    const ext = effectiveGenerationType === "image" ? "jpg" : "mp4"
    const filename = `${promptId}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from("media")
      .upload(`${user.id}/${filename}`, mediaBlob, {
        contentType:
          effectiveGenerationType === "image" ? "image/jpeg" : "video/mp4",
      })

    if (uploadError) throw uploadError

    const path = `${user.id}/${filename}`

    const { error: insertError } = await supabase.from("media").insert({
      prompt_id: promptId,
      path,
      type: effectiveGenerationType,
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
    } else if (error instanceof Error) {
      return NextResponse.json(
        { message: error.message || "Internal server error" },
        { status: 500 },
      )
    } else {
      return NextResponse.json(
        { message: "Internal server error" },
        { status: 500 },
      )
    }
  }
}
