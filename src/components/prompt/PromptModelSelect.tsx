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

/** Model ids in the order listed by the Runway models guide. */
const MODEL_ORDER: Record<"image" | "video", readonly string[]> = {
  image: [
    "gpt_image_2_5_flare",
    "gpt_image_2_5_sunburst",
    "muse_image",
    "grok_imagine_image_2",
    "seedream5_pro",
    "seedream5_lite",
    "gen4_image",
    "gen4_image_turbo",
    "gemini_image3_pro",
    "gemini_image3.1_flash",
    "gpt_image_2",
    "gemini_2.5_flash",
  ],
  video: [
    "wan3",
    "seedance2_5",
    "grok_imagine_1_5",
    "seedance2",
    "seedance2_fast",
    "seedance2_mini",
    "h3_max",
    "hailuo3",
    "aleph2",
    "gen4.5",
    "gen4_turbo",
    "act_two",
    "veo3.1",
    "veo3.1_fast",
    "happyhorse_1_0",
    "gemini_omni_flash",
    "magnific_video_upscaler_creative",
  ],
}

/**
 * Model picker. Automatically lists models that support the current
 * generation type (video or image), derived from the registry.
 */
export default function PromptModelSelect() {
  const { mode, model, setModel, generationType, modelConfig } = usePromptContext()

  if (mode === "view" || mode === "loading") return null

  const models = getModelsByGenerationType(generationType).slice().sort((a, b) => {
    const order = MODEL_ORDER[generationType]
    const ai = order.indexOf(a.id)
    const bi = order.indexOf(b.id)
    if (ai !== -1 && bi !== -1) return ai - bi
    if (ai !== -1) return -1
    if (bi !== -1) return 1
    return a.definition.displayName.localeCompare(b.definition.displayName)
  })
  if (!models.some((entry) => entry.id === model)) {
    models.unshift({ id: model, definition: modelConfig })
  }

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
