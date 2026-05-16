import type { Model, GenerationType } from "@runway-playground/shared"

// ---------------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------------

export interface MediaItem {
  id: string
  path: string
  url: string
  type: "image" | "video"
  category: "input" | "output"
  tag: string | null
  /** Keyframe role for image-to-video models (`first` / `last`). */
  position?: string | null
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

export interface Prompt {
  id: string
  chat_id?: string
  prompt_text: string
  created_at: string
  model: Model
  generation_type: GenerationType
  ratio: string
  media: MediaItem[]
}

// ---------------------------------------------------------------------------
// Generation payloads (used between components and hooks)
// ---------------------------------------------------------------------------

export interface FileWithTag {
  file: File
  tag: string | null
  position: "first" | "last" | null
}

export interface ExistingMediaRef {
  id: string
  path: string
  url: string
  type: "image" | "video"
  tag: string | null
  position: "first" | "last" | null
}

export interface GeneratePayload {
  text: string
  model: Model
  generationType: GenerationType
  filesWithTags: FileWithTag[]
  ratio: string
  /** Partial overrides for registry defaults (e.g. `duration`, `audio`). */
  additionalParams?: Record<string, unknown>
}

export interface EditPayload {
  text: string
  model: Model
  generationType: GenerationType
  existingMedia: ExistingMediaRef[]
  newFilesWithTags: FileWithTag[]
  ratio: string
  additionalParams?: Record<string, unknown>
}
