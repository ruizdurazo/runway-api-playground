"use client"

import { createContext, useContext } from "react"
import type { Model } from "@/lib/models/registry"
import type { ModelDefinition, GenerationType } from "@/lib/models/types"
import type { Prompt, MediaItem } from "@/lib/types"

// ---------------------------------------------------------------------------
// File with preview (for new uploads)
// ---------------------------------------------------------------------------

export interface FileWithPreview {
  file: File
  tag: string
  preview: string
  position: "first" | "last" | null
}

// ---------------------------------------------------------------------------
// Context value
// ---------------------------------------------------------------------------

export interface PromptContextValue {
  // Mode
  mode: "input" | "view" | "edit" | "loading"
  setMode: (mode: "input" | "view" | "edit" | "loading") => void

  // Model
  model: Model
  setModel: (model: Model) => void
  modelConfig: ModelDefinition

  // Generation type
  generationType: GenerationType
  setGenerationType: (type: GenerationType) => void

  // Prompt text
  text: string
  setText: (text: string) => void

  // Files
  existingMedia: (MediaItem & { position: "first" | "last" | null })[]
  setExistingMedia: (
    media: (MediaItem & { position: "first" | "last" | null })[],
  ) => void
  newFiles: FileWithPreview[]
  addFiles: (files: File[]) => void
  removeNewFile: (index: number) => void
  removeExistingMedia: (index: number) => void
  updateTag: (index: number, tag: string, isExisting: boolean) => void

  // Ratio
  ratio: string
  setRatio: (ratio: string) => void

  // Show references toggle
  showReferences: boolean
  setShowReferences: (show: boolean) => void

  // Computed
  maxInputCount: number
  currentInputCount: number

  // Existing prompt data (view/edit modes)
  prompt?: Prompt

  // Output media (view mode)
  outputs: MediaItem[]

  // Callbacks
  onSubmit: (e: React.FormEvent) => void
  onDelete?: (promptId: string) => Promise<void>
  onRegenerate?: (promptId: string, freshPrompt?: Prompt) => Promise<void>
}

// ---------------------------------------------------------------------------
// Context + hook
// ---------------------------------------------------------------------------

export const PromptContext = createContext<PromptContextValue | null>(null)

export function usePromptContext(): PromptContextValue {
  const ctx = useContext(PromptContext)
  if (!ctx) {
    throw new Error(
      "Prompt.* components must be rendered inside <Prompt.Root>",
    )
  }
  return ctx
}
