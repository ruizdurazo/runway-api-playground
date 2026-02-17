export type GenerationType = "image" | "video"

export type EndpointType =
  | "text_to_image"
  | "image_to_video"
  | "text_to_video"
  | "video_to_video"
  | "video_upscale"
  | "character_performance"

// ---------------------------------------------------------------------------
// Input configurations
// ---------------------------------------------------------------------------

/** Standard single-type inputs (images or videos with count constraints). */
export interface StandardInputConfig {
  kind: "standard"
  type: "image" | "video"
  minCount: number
  maxCount: number
  tagsAllowed: boolean
  positionsRequired: boolean
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
  default: number | boolean
  options?: readonly number[]
  min?: number
  max?: number
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
    maxLength?: number
  }
  inputs: InputConfig
  ratios: readonly string[]
  additionalParams?: Record<string, ParamOption>
}
