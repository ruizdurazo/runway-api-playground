import type { EndpointType } from "../models/types.js"
import type { GenerationStrategy } from "./types.js"

import { textToImageStrategy } from "./textToImage.js"
import { imageToVideoStrategy } from "./imageToVideo.js"
import { textToVideoStrategy } from "./textToVideo.js"
import { videoToVideoStrategy } from "./videoToVideo.js"
import { videoUpscaleStrategy } from "./videoUpscale.js"
import { characterPerformanceStrategy } from "./characterPerformance.js"

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

export type { GenerationStrategy, GenerationResult, GenerationParams, Asset } from "./types.js"
