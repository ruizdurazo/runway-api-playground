import type { GenerationStrategy, GenerationParams, GenerationResult } from "./types"

export const characterPerformanceStrategy: GenerationStrategy = {
  async execute(params: GenerationParams): Promise<GenerationResult> {
    const { client, model, assets, ratio, additionalParams } = params

    const characterAsset = assets.find((a) => a.tag === "character")
    const referenceAsset = assets.find((a) => a.tag === "reference")

    if (!characterAsset) {
      throw new Error("Character performance requires a character input")
    }
    if (!referenceAsset) {
      throw new Error("Character performance requires a reference video input")
    }

    // Determine if the character input is an image or video based on the URL
    const isVideo = characterAsset.url.match(/\.(mp4|webm|mov)(\?|$)/i)
    const character = isVideo
      ? { type: "video" as const, uri: characterAsset.url }
      : { type: "image" as const, uri: characterAsset.url }

    const reference = {
      type: "video" as const,
      uri: referenceAsset.url,
    }

    const task = await client.characterPerformance
      .create({
        model: model as "act_two",
        character,
        reference,
        ratio: ratio as "1280:720",
        ...(additionalParams?.bodyControl !== undefined
          ? { bodyControl: additionalParams.bodyControl as boolean }
          : {}),
        ...(additionalParams?.expressionIntensity !== undefined
          ? { expressionIntensity: additionalParams.expressionIntensity as number }
          : {}),
      })
      .waitForTaskOutput()

    const url = task.output?.[0]
    if (!url) throw new Error("Character performance produced no output")

    return { url, mediaType: "video" }
  },
}
