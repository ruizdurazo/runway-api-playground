import type { GenerationStrategy, GenerationParams, GenerationResult } from "./types"

export const imageToVideoStrategy: GenerationStrategy = {
  async execute(params: GenerationParams): Promise<GenerationResult> {
    const { client, model, promptText, assets, ratio, additionalParams } = params

    const duration = (additionalParams?.duration as number) ?? 10

    // If no image assets provided, generate an intermediate image first
    let promptImage: string
    if (assets.length === 0) {
      const imageTask = await client.textToImage
        .create({
          model: "gen4_image_turbo" as const,
          promptText,
          ratio: ratio as "1280:720",
        })
        .waitForTaskOutput()

      const imageUrl = imageTask.output?.[0]
      if (!imageUrl) throw new Error("Failed to generate intermediate image")
      promptImage = imageUrl
    } else {
      promptImage = assets[0].url
    }

    const task = await client.imageToVideo
      .create({
        model: model as "gen4_turbo",
        promptImage,
        promptText,
        ratio: ratio as "1280:720",
        duration: duration as 5 | 10,
      })
      .waitForTaskOutput()

    const url = task.output?.[0]
    if (!url) throw new Error("Image-to-video produced no output")

    return { url, mediaType: "video" }
  },
}
