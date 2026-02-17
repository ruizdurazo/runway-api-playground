import type { GenerationStrategy, GenerationParams, GenerationResult } from "./types"

export const textToImageStrategy: GenerationStrategy = {
  async execute(params: GenerationParams): Promise<GenerationResult> {
    const { client, model, promptText, assets, ratio } = params

    let effectiveModel = model
    const referenceImages = assets.map((a, index) => ({
      uri: a.url,
      tag: a.tag || `ref${index + 1}`,
    }))

    // gen4_image with references should use gen4_image_turbo
    if (model === "gen4_image" && referenceImages.length > 0) {
      effectiveModel = "gen4_image_turbo"
    }

    const createParams: Record<string, unknown> = {
      model: effectiveModel,
      promptText,
      ratio,
    }

    if (referenceImages.length > 0) {
      createParams.referenceImages = referenceImages
    }

    // @ts-expect-error -- SDK model type narrowing
    const task = await client.textToImage.create(createParams).waitForTaskOutput()
    const url = task.output?.[0]
    if (!url) throw new Error("Text-to-image produced no output")

    return { url, mediaType: "image" }
  },
}
