import type { GenerationStrategy, GenerationParams, GenerationResult } from "./types"

export const textToVideoStrategy: GenerationStrategy = {
  async execute(params: GenerationParams): Promise<GenerationResult> {
    const { client, model, promptText, ratio, additionalParams } = params

    const duration = (additionalParams?.duration as number) ?? 8

    const task = await client.textToVideo
      .create({
        model: model as "veo3",
        promptText,
        ratio: ratio as "1280:720",
        duration: duration as 8,
      })
      .waitForTaskOutput()

    const url = task.output?.[0]
    if (!url) throw new Error("Text-to-video produced no output")

    return { url, mediaType: "video" }
  },
}
