import { ensureRunwayImageUri } from "../ensure-runway-image-uri.js"
import { getModelById } from "../models/registry.js"
import type { Model } from "../models/registry.js"
import type { EndpointType } from "../models/types.js"
import type { Asset, GenerationParams, GenerationResult } from "./types.js"

function numericParam(value: unknown, fallback: number): number {
  if (typeof value === "number" && !Number.isNaN(value)) return value
  if (typeof value === "string" && value.trim() !== "" && value !== "auto") {
    const n = Number(value)
    if (!Number.isNaN(n)) return n
  }
  return fallback
}

function durationValue(
  additionalParams: Record<string, unknown> | undefined,
  fallback: number,
): number | "auto" {
  if (additionalParams?.duration === "auto") return "auto"
  return numericParam(additionalParams?.duration, fallback)
}

function assetIsVideo(asset: Asset): boolean {
  return asset.type === "video"
}

async function mediaUri(
  client: GenerationParams["client"],
  uri: string,
): Promise<string> {
  return ensureRunwayImageUri(uri, client)
}

function applyAudio(
  body: Record<string, unknown>,
  additionalParams: Record<string, unknown> | undefined,
): void {
  if (typeof additionalParams?.audio === "boolean") {
    body.audio = additionalParams.audio
  }
}

/**
 * Builds and runs image-to-video, text-to-video, or video-to-video for models
 * whose request shape is not the original Gen-4 / Veo path.
 * Returns null when this module does not handle the model.
 */
export async function executeProfiledVideo(
  params: GenerationParams,
  endpoint: EndpointType,
): Promise<GenerationResult | null> {
  const modelDef = getModelById(params.model as Model)
  if (!modelDef.videoProfile) return null

  const client = params.client
  const task = await (async () => {
    switch (endpoint) {
      case "text_to_video":
        return client.textToVideo
          // @ts-expect-error -- SDK body is a discriminated union by model id
          .create(await textBody(params))
          .waitForTaskOutput()
      case "video_to_video":
        return client.videoToVideo
          // @ts-expect-error -- SDK body is a discriminated union by model id
          .create(await videoBody(params))
          .waitForTaskOutput()
      case "image_to_video":
        return client.imageToVideo
          // @ts-expect-error -- SDK body is a discriminated union by model id
          .create(await imageBody(params))
          .waitForTaskOutput()
      default:
        return null
    }
  })()

  if (!task) return null
  const url = task.output?.[0]
  if (!url) throw new Error("Video generation produced no output")
  return { url, mediaType: "video" }
}

async function textBody(params: GenerationParams): Promise<Record<string, unknown>> {
  const { client, model, promptText, assets, ratio, additionalParams } = params
  const modelDef = getModelById(model as Model)
  const duration = durationValue(
    additionalParams,
    typeof modelDef.additionalParams?.duration?.default === "number"
      ? modelDef.additionalParams.duration.default
      : 5,
  )
  const images = assets.filter((asset) => !assetIsVideo(asset))
  const videos = assets.filter(assetIsVideo)
  const body: Record<string, unknown> = { model }
  if (promptText) body.promptText = promptText
  if (modelDef.ratios.length > 0 && ratio && modelDef.videoProfile !== "h3") {
    body.ratio = ratio
  }
  if (modelDef.additionalParams?.duration) body.duration = duration
  applyAudio(body, additionalParams)
  if (typeof additionalParams?.resolution === "string" && modelDef.videoProfile !== "happyhorse") {
    body.resolution = additionalParams.resolution
  }

  if (modelDef.videoProfile === "wan" || modelDef.videoProfile === "hailuo" || modelDef.videoProfile === "seedance") {
    if (images.length > 0) {
      body.references = await Promise.all(
        images.map(async (asset) => ({ uri: await mediaUri(client, asset.url) })),
      )
    }
    if (videos.length > 0) {
      body.referenceVideos = await Promise.all(
        videos.map(async (asset) => ({
          type: "video" as const,
          uri: await mediaUri(client, asset.url),
        })),
      )
    }
  }

  return body
}

async function imageBody(params: GenerationParams): Promise<Record<string, unknown>> {
  const { client, model, promptText, assets, ratio, additionalParams } = params
  const modelDef = getModelById(model as Model)
  const images = assets.filter((asset) => !assetIsVideo(asset))
  const videos = assets.filter(assetIsVideo)
  if (images.length === 0) {
    throw new Error(`${modelDef.displayName} image-to-video requires an image`)
  }

  const duration = durationValue(
    additionalParams,
    typeof modelDef.additionalParams?.duration?.default === "number"
      ? modelDef.additionalParams.duration.default
      : 5,
  )
  const body: Record<string, unknown> = { model }
  if (promptText) body.promptText = promptText
  if (modelDef.additionalParams?.duration) body.duration = duration
  applyAudio(body, additionalParams)

  const profile = modelDef.videoProfile
  const keyframe = images.some((asset) => asset.position === "first" || asset.position === "last")

  if (profile === "grok" || profile === "happyhorse" || profile === "h3" || profile === "gemini_omni") {
    if (images.length > (profile === "h3" ? 2 : 1)) {
      throw new Error(
        `${modelDef.displayName} accepts ${profile === "h3" ? "up to two keyframes" : "a single first frame"}`,
      )
    }
    const prepared = await Promise.all(
      images.map(async (asset) => ({
        uri: await mediaUri(client, asset.url),
        position: (asset.position ?? "first") as "first" | "last",
      })),
    )
    body.promptImage = prepared
    if (profile === "h3" || profile === "grok" || profile === "happyhorse") {
      if (typeof additionalParams?.resolution === "string") {
        body.resolution = additionalParams.resolution
      }
    }
    if (profile === "gemini_omni" && ratio) body.ratio = ratio
    return body
  }

  if (ratio && modelDef.ratios.length > 0) body.ratio = ratio
  if (profile === "hailuo" && typeof additionalParams?.resolution === "string") {
    body.resolution = additionalParams.resolution
  }

  const prepared = await Promise.all(
    images.map(async (asset) => {
      const uri = await mediaUri(client, asset.url)
      if (keyframe) {
        return { uri, position: (asset.position ?? "first") as "first" | "last" }
      }
      return { uri }
    }),
  )
  body.promptImage = prepared

  if (videos.length > 0 && (profile === "wan" || profile === "hailuo")) {
    body.referenceVideos = await Promise.all(
      videos.map(async (asset) => ({
        type: "video" as const,
        uri: await mediaUri(client, asset.url),
      })),
    )
  }

  return body
}

async function videoBody(params: GenerationParams): Promise<Record<string, unknown>> {
  const { client, model, promptText, assets, ratio, additionalParams } = params
  const modelDef = getModelById(model as Model)
  const videos = assets.filter(assetIsVideo)
  const images = assets.filter((asset) => !assetIsVideo(asset))
  if (videos.length === 0) {
    throw new Error(`${modelDef.displayName} requires a video input`)
  }

  const duration = durationValue(
    additionalParams,
    typeof modelDef.additionalParams?.duration?.default === "number"
      ? modelDef.additionalParams.duration.default
      : 5,
  )

  if (modelDef.videoProfile === "aleph2") {
    const body: Record<string, unknown> = {
      model,
      videoUri: await mediaUri(client, videos[0]!.url),
    }
    if (promptText) body.promptText = promptText
    if (ratio) body.targetAspectRatio = ratio
    return body
  }

  if (modelDef.videoProfile === "gemini_omni") {
    const body: Record<string, unknown> = {
      model,
      videoUri: await mediaUri(client, videos[0]!.url),
      promptText,
    }
    if (images.length > 0) {
      body.references = await Promise.all(
        images.map(async (asset) => ({ uri: await mediaUri(client, asset.url) })),
      )
    }
    return body
  }

  const mode = additionalParams?.mode
  const body: Record<string, unknown> = {
    model,
    promptVideo: await mediaUri(client, videos[0]!.url),
  }
  if (promptText) body.promptText = promptText
  if (modelDef.additionalParams?.duration) body.duration = duration
  applyAudio(body, additionalParams)
  if (typeof mode === "string") body.mode = mode
  if (mode === "extend" && !promptText) {
    throw new Error(`${modelDef.displayName} extend mode requires a prompt`)
  }
  if (mode !== "extend" && ratio && modelDef.ratios.length > 0) body.ratio = ratio
  if (modelDef.videoProfile === "hailuo" && typeof additionalParams?.resolution === "string") {
    body.resolution = additionalParams.resolution
  }
  if (images.length > 0) {
    body.references = await Promise.all(
      images.map(async (asset) => ({ uri: await mediaUri(client, asset.url) })),
    )
  }
  if (videos.length > 1) {
    body.referenceVideos = await Promise.all(
      videos.slice(1).map(async (asset) => ({
        type: "video" as const,
        uri: await mediaUri(client, asset.url),
      })),
    )
  }
  return body
}
