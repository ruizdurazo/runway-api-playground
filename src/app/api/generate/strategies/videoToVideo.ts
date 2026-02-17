import type { GenerationStrategy, GenerationParams, GenerationResult } from "./types"

export const videoToVideoStrategy: GenerationStrategy = {
  async execute(params: GenerationParams): Promise<GenerationResult> {
    const { client, model, promptText, assets, ratio } = params

    if (assets.length === 0) {
      throw new Error("Video-to-video requires at least one video input")
    }

    const videoUri = assets[0].url

    // Additional image references (optional for gen4_aleph)
    const referenceImages = assets.slice(1).map((a, index) => ({
      uri: a.url,
      tag: a.tag || `ref${index + 1}`,
    }))

    const createParams = {
      model: model as "gen4_aleph",
      promptText,
      videoUri,
      ratio: ratio as "1280:720",
      ...(referenceImages.length > 0 ? { referenceImages } : {}),
    }

    const task = await client.videoToVideo
      .create(createParams)
      .waitForTaskOutput()

    const url = task.output?.[0]
    if (!url) throw new Error("Video-to-video produced no output")

    return { url, mediaType: "video" }
  },
}
