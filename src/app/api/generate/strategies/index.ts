import type { EndpointType } from "@/lib/models/types"
import type { GenerationStrategy } from "./types"

import { textToImageStrategy } from "./textToImage"
import { imageToVideoStrategy } from "./imageToVideo"
import { textToVideoStrategy } from "./textToVideo"
import { videoToVideoStrategy } from "./videoToVideo"
import { videoUpscaleStrategy } from "./videoUpscale"
import { characterPerformanceStrategy } from "./characterPerformance"

const STRATEGY_MAP: Record<EndpointType, GenerationStrategy> = {
  text_to_image: textToImageStrategy,
  image_to_video: imageToVideoStrategy,
  text_to_video: textToVideoStrategy,
  video_to_video: videoToVideoStrategy,
  video_upscale: videoUpscaleStrategy,
  character_performance: characterPerformanceStrategy,
}

export function getStrategy(endpoint: EndpointType): GenerationStrategy {
  const strategy = STRATEGY_MAP[endpoint]
  if (!strategy) {
    throw new Error(`No generation strategy found for endpoint: ${endpoint}`)
  }
  return strategy
}

export type { GenerationStrategy, GenerationResult, GenerationParams, Asset } from "./types"
