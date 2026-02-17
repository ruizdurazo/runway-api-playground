"use client"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/ToggleGroup"
import type { GenerationType } from "@/lib/models/types"
import { usePromptContext } from "./context"

/**
 * Video / Image toggle. Only renders in input or edit mode.
 */
export default function PromptGenerationTypeToggle() {
  const { mode, generationType, setGenerationType } = usePromptContext()

  if (mode === "view" || mode === "loading") return null

  return (
    <ToggleGroup
      type="single"
      value={generationType}
      onValueChange={(value) => {
        if (value) setGenerationType(value as GenerationType)
      }}
    >
      <ToggleGroupItem value="video">Video</ToggleGroupItem>
      <ToggleGroupItem value="image">Image</ToggleGroupItem>
    </ToggleGroup>
  )
}
