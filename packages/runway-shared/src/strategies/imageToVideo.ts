import { ensureRunwayImageUri } from "../ensure-runway-image-uri.js"
import { getModelById } from "../models/registry.js"
import type { Model } from "../models/registry.js"
import type { GenerationStrategy, GenerationParams, GenerationResult } from "./types.js"

function numericParam(value: unknown, fallback: number): number {
  if (typeof value === "number" && !Number.isNaN(value)) return value
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value)
    if (!Number.isNaN(n)) return n
  }
  return fallback
}

/** Runway rejects `promptImage` when width/height > 2; t2i must not match ultrawide video ratios. */
const INTERMEDIATE_FIRST_FRAME_RATIO = "1280:720" as const

export const imageToVideoStrategy: GenerationStrategy = {
  async execute(params: GenerationParams): Promise<GenerationResult> {
    const { client, model, promptText, assets, ratio, additionalParams } = params
    const modelDef = getModelById(model as Model)
    const supportsLastFrame = modelDef.supportsLastFrame === true

    const duration = numericParam(
      additionalParams?.duration,
      typeof modelDef.additionalParams?.duration?.default === "number"
        ? (modelDef.additionalParams.duration.default as number)
        : 10,
    )

    let promptImage: string | Array<{ uri: string; position: "first" | "last" }>

    if (assets.length === 0) {
      const imageTask = await client.textToImage
        .create({
          model: "gen4_image" as const,
          promptText,
          ratio: INTERMEDIATE_FIRST_FRAME_RATIO,
        })
        .waitForTaskOutput()

      const imageUrl = imageTask.output?.[0]
      if (!imageUrl) throw new Error("Failed to generate intermediate image")
      promptImage = await ensureRunwayImageUri(imageUrl)
    } else {
      const imageAssets = await Promise.all(
        assets.map(async (a) => ({
          url: await ensureRunwayImageUri(a.url),
          position: a.position,
        })),
      )

      if (imageAssets.length === 1) {
        const only = imageAssets[0]
        if (!only) throw new Error("Missing image input")
        if (supportsLastFrame && only.position === "last") {
          throw new Error("Cannot generate with only a last frame")
        }
        promptImage = only.url
      } else {
        promptImage = [...imageAssets]
          .sort((x, y) => {
            const rank = (p?: "first" | "last") => (p === "last" ? 1 : 0)
            return rank(x.position) - rank(y.position)
          })
          .map((a) => ({
            uri: a.url,
            position: (a.position ?? "first") as "first" | "last",
          }))
      }
    }

    const body: Record<string, unknown> = {
      model,
      promptImage,
      ratio,
    }
    if (promptText) body.promptText = promptText

    if (model === "veo3") {
      body.duration = 8
    } else if (model === "veo3.1" || model === "veo3.1_fast") {
      body.duration = duration as 4 | 6 | 8
      if (additionalParams?.audio !== undefined) {
        body.audio = additionalParams.audio
      }
    } else if (model === "gen4.5") {
      body.duration = duration
    } else if (model === "gen3a_turbo") {
      body.duration = duration as 5 | 10
    } else {
      body.duration = duration
    }

    if (additionalParams?.seed !== undefined && typeof additionalParams.seed === "number") {
      body.seed = additionalParams.seed
    }

    const task = await client.imageToVideo
      // @ts-expect-error -- SDK body is a discriminated union by model id
      .create(body)
      .waitForTaskOutput()

    const url = task.output?.[0]
    if (!url) throw new Error("Image-to-video produced no output")

    return { url, mediaType: "video" }
  },
}
