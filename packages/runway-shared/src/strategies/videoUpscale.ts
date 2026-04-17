import type { GenerationStrategy, GenerationParams, GenerationResult } from "./types"

export const videoUpscaleStrategy: GenerationStrategy = {
  async execute(params: GenerationParams): Promise<GenerationResult> {
    const { client, assets } = params

    if (assets.length !== 1) {
      throw new Error("Upscale requires exactly one video input")
    }

    const task = await client.videoUpscale
      .create({
        model: "upscale_v1" as const,
        videoUri: assets[0].url,
      })
      .waitForTaskOutput()

    const url = task.output?.[0]
    if (!url) throw new Error("Video upscale produced no output")

    return { url, mediaType: "video" }
  },
}
