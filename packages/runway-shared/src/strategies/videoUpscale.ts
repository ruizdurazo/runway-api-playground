import { ensureRunwayImageUri } from "../ensure-runway-image-uri.js"
import type { GenerationStrategy, GenerationParams, GenerationResult } from "./types.js"

export const videoUpscaleStrategy: GenerationStrategy = {
  async execute(params: GenerationParams): Promise<GenerationResult> {
    const { client, assets } = params

    if (assets.length !== 1) {
      throw new Error("Upscale requires exactly one video input")
    }

    const resolution = params.additionalParams?.resolution
    const submitted = await client.post("/v1/video_upscale", {
      body: {
        model: params.model,
        videoUri: await ensureRunwayImageUri(assets[0].url, client),
        ...(typeof resolution === "string" ? { resolution } : {}),
      },
    })
    const { id } = (await submitted) as { id: string }
    const task = await client.tasks.retrieve(id).waitForTaskOutput()

    const url = task.output?.[0]
    if (!url) throw new Error("Video upscale produced no output")

    return { url, mediaType: "video" }
  },
}
