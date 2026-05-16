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

export const textToVideoStrategy: GenerationStrategy = {
  async execute(params: GenerationParams): Promise<GenerationResult> {
    const { client, model, promptText, ratio, additionalParams } = params
    const modelDef = getModelById(model as Model)

    const defaultDur =
      typeof modelDef.additionalParams?.duration?.default === "number"
        ? modelDef.additionalParams.duration.default
        : 8

    const duration = numericParam(additionalParams?.duration, defaultDur)

    const body: Record<string, unknown> = {
      model,
      promptText,
      ratio,
    }

    if (model === "veo3") {
      body.duration = 8
    } else if (model === "gen4.5") {
      body.duration = duration
    } else if (model === "veo3.1" || model === "veo3.1_fast") {
      body.duration = duration as 4 | 6 | 8
      if (additionalParams?.audio !== undefined) {
        body.audio = additionalParams.audio
      }
    } else {
      body.duration = duration
    }

    if (additionalParams?.seed !== undefined && typeof additionalParams.seed === "number") {
      body.seed = additionalParams.seed
    }

    const task = await client.textToVideo
      // @ts-expect-error -- SDK body is a discriminated union by model id
      .create(body)
      .waitForTaskOutput()

    const url = task.output?.[0]
    if (!url) throw new Error("Text-to-video produced no output")

    return { url, mediaType: "video" }
  },
}
