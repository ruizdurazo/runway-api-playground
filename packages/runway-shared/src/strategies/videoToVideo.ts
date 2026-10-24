import { ensureRunwayImageUri } from "../ensure-runway-image-uri.js"
import { executeProfiledVideo } from "./multimodal-video.js"
import type { GenerationStrategy, GenerationParams, GenerationResult } from "./types.js"

export const videoToVideoStrategy: GenerationStrategy = {
  async execute(params: GenerationParams): Promise<GenerationResult> {
    const profiled = await executeProfiledVideo(params, "video_to_video")
    if (profiled) return profiled

    const { client, model, promptText, assets, ratio } = params

    if (assets.length === 0) {
      throw new Error("Video-to-video requires at least one video input")
    }

    const videoUri = await ensureRunwayImageUri(assets[0].url, client)

    // Additional image references (optional for gen4_aleph)
    const referenceImages = await Promise.all(
      assets.slice(1).map(async (a, index) => ({
        uri: await ensureRunwayImageUri(a.url, client),
        tag: a.tag || `ref${index + 1}`,
      })),
    )

    const createParams = {
      model: model as "gen4_aleph",
      promptText,
      videoUri,
      ratio: ratio as "1280:720",
      ...(referenceImages.length > 0 ? { referenceImages } : {}),
    }

    const task = await client.videoToVideo
      // @ts-expect-error -- SDK body is a discriminated union by model id
      .create(createParams)
      .waitForTaskOutput()

    const url = task.output?.[0]
    if (!url) throw new Error("Video-to-video produced no output")

    return { url, mediaType: "video" }
  },
}
