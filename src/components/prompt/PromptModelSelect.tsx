"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select"
import {
  getModelsByGenerationType,
  type Model,
} from "@runway-playground/shared"
import { usePromptContext } from "./context"

import styles from "./prompt.module.scss"

/** `POST /v1/text_to_image` `model` values, in [API reference](https://docs.dev.runwayml.com/api) order. */
const TEXT_TO_IMAGE_MODEL_ORDER = [
  "gen4_image_turbo",
  "gen4_image",
  "gpt_image_2",
  "gemini_image3_pro",
  "gemini_2.5_flash",
] as const

/**
 * Model picker. Automatically lists models that support the current
 * generation type (video or image), derived from the registry.
 */
export default function PromptModelSelect() {
  const { mode, model, setModel, generationType } = usePromptContext()

  if (mode === "view" || mode === "loading") return null

  const models = getModelsByGenerationType(generationType).slice().sort((a, b) => {
    if (generationType !== "image") {
      return a.definition.displayName.localeCompare(b.definition.displayName)
    }
    const order = TEXT_TO_IMAGE_MODEL_ORDER as readonly string[]
    const ai = order.indexOf(a.id)
    const bi = order.indexOf(b.id)
    if (ai !== -1 && bi !== -1) return ai - bi
    if (ai !== -1) return -1
    if (bi !== -1) return 1
    return a.definition.displayName.localeCompare(b.definition.displayName)
  })

  return (
    <Select value={model} onValueChange={(v) => setModel(v as Model)}>
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
