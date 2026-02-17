"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select"
import { usePromptContext } from "./context"

import styles from "./prompt.module.scss"

/**
 * Aspect ratio picker. Renders nothing if the model has no configurable ratios.
 */
export default function PromptRatioSelect() {
  const { mode, modelConfig, ratio, setRatio } = usePromptContext()

  if (mode === "view" || mode === "loading") return null
  if (modelConfig.ratios.length === 0) return null

  return (
    <Select value={ratio} onValueChange={setRatio}>
      <SelectTrigger className={styles.selectInput}>
        <SelectValue placeholder="Aspect ratio" />
      </SelectTrigger>
      <SelectContent>
        {modelConfig.ratios.map((r) => (
          <SelectItem key={r} value={r}>
            {r}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
