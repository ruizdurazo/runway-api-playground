"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select"
import { getModelsByGenerationType } from "@/lib/models/registry"
import type { Model } from "@/lib/models/registry"
import { usePromptContext } from "./context"

import styles from "./prompt.module.scss"

/**
 * Model picker. Automatically lists models that support the current
 * generation type (video or image), derived from the registry.
 */
export default function PromptModelSelect() {
  const { mode, model, setModel, generationType } = usePromptContext()

  if (mode === "view" || mode === "loading") return null

  const models = getModelsByGenerationType(generationType)

  return (
    <Select
      value={model}
      onValueChange={(v) => setModel(v as Model)}
    >
      <SelectTrigger className={styles.selectInput}>
        <SelectValue placeholder="Model" />
      </SelectTrigger>
      <SelectContent>
        {models.map(({ id, definition }) => (
          <SelectItem key={id} value={id}>
            {definition.displayName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
