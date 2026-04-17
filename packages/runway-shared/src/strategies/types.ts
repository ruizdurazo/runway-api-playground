import type RunwayML from "@runwayml/sdk"

export interface Asset {
  url: string
  tag: string
}

export interface GenerationParams {
  client: RunwayML
  model: string
  promptText: string
  assets: Asset[]
  ratio?: string
  additionalParams?: Record<string, unknown>
}

export interface GenerationResult {
  url: string
  mediaType: "image" | "video"
}

export interface GenerationStrategy {
  execute(params: GenerationParams): Promise<GenerationResult>
}
