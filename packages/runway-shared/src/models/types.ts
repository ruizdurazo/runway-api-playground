export type GenerationType = "image" | "video"

export type EndpointType =
  | "text_to_image"
  | "image_to_video"
  | "text_to_video"
  | "video_to_video"
  | "video_upscale"
  | "character_performance"

/**
 * How a video model maps inputs onto Runway endpoints.
 * `seedance` supports reference images, first/last keyframes, and video-to-video.
 */
export type VideoProfile =
  | "gen4"
  | "veo"
  | "seedance"
  | "wan"
  | "hailuo"
  | "grok"
  | "happyhorse"
  | "h3"
  | "gemini_omni"
  | "aleph2"

// ---------------------------------------------------------------------------
// Input configurations
// ---------------------------------------------------------------------------

/** Standard single-type inputs (images or videos with count constraints). */
export interface StandardInputConfig {
  kind: "standard"
  /** `media` accepts both images and videos. */
  type: "image" | "video" | "media"
  minCount: number
  maxCount: number
  maxImages?: number
  maxVideos?: number
  tagsAllowed: boolean
  positionsRequired: boolean
  /**
   * Images may be untagged references, or first/last keyframes.
   * Those two modes cannot be mixed, and keyframes cannot be combined with video.
   */
  flexibleImageRole?: boolean
  allowedFileTypes: readonly string[]
  /** Optional secondary reference inputs (e.g. gen4_aleph: video + image refs). */
  additionalReferences?: {
    type: "image"
    minCount: number
    maxCount: number
    tagsAllowed: boolean
    allowedFileTypes: readonly string[]
  }
}

/** A single named input slot (e.g. "character", "reference" for act_two). */
export interface NamedInputSlot {
  type: readonly ("image" | "video")[] | "image" | "video"
  minCount: number
  maxCount: number
  allowedFileTypes: readonly string[]
}

/** Named input slots -- each slot has distinct semantics. */
export interface NamedInputConfig {
  kind: "named"
  slots: Record<string, NamedInputSlot>
}

/** Model requires no file inputs (e.g. text-only generation). */
export interface NoInputConfig {
  kind: "none"
}

export type InputConfig = StandardInputConfig | NamedInputConfig | NoInputConfig

// ---------------------------------------------------------------------------
// Additional parameter options
// ---------------------------------------------------------------------------

export interface ParamOption {
  default: number | boolean | string
  options?: readonly (number | string)[]
  min?: number
  max?: number
  /** Numeric duration may also be the string `auto`. */
  allowAuto?: boolean
}

// ---------------------------------------------------------------------------
// Model definition
// ---------------------------------------------------------------------------

export interface ModelDefinition {
  displayName: string
  endpoint: EndpointType
  /** Alternate endpoint when no media inputs are provided (e.g. text-only video). */
  textOnlyEndpoint?: EndpointType
  category: "video" | "image" | "upscale"
  creditsPerUnit: number
  creditUnit: "second" | "image"
  generationTypes: readonly GenerationType[]
  prompt: {
    required: boolean
    /** When the prompt is optional, still require text if no media is attached. */
    requiredWithoutInputs?: boolean
    maxLength?: number
  }
  inputs: InputConfig
  /** When set, text-only flows (`textOnlyEndpoint`) restrict ratio to this subset. */
  textOnlyRatios?: readonly string[]
  /**
   * Ratios that are valid only for keyframe image-to-video.
   * Other listed ratios are for reference and text-to-video flows.
   */
  keyframeRatios?: readonly string[]
  ratios: readonly string[]
  /** Hidden from the model picker. Older saved prompts can still resolve. */
  listed?: boolean
  /** Used when the request includes a video and the model supports video-to-video. */
  videoEndpoint?: EndpointType
  videoProfile?: VideoProfile
  /** Send this field name instead of `ratio` (Aleph 2.0 uses `targetAspectRatio`). */
  ratioParam?: "ratio" | "targetAspectRatio"
  additionalParams?: Record<string, ParamOption>
  /**
   * When true (with `inputs.positionsRequired`), inputs may use `last` for a final
   * keyframe as well as `first`. Models that only support a single first frame omit this.
   */
  supportsLastFrame?: boolean
}
