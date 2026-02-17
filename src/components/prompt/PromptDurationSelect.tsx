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
 * Duration picker. Only renders when the current model has a `duration`
 * additional parameter with selectable options.
 */
export default function PromptDurationSelect() {
  const { mode, modelConfig } = usePromptContext()

  if (mode === "view" || mode === "loading") return null

  const durationParam = modelConfig.additionalParams?.duration
  if (!durationParam || !durationParam.options || durationParam.options.length <= 1)
    return null

  // Duration is informational right now -- the API route uses the model's default.
  // This component surfaces the available options to the user.
  return (
    <Select defaultValue={String(durationParam.default)}>
      <SelectTrigger className={styles.selectInput}>
        <SelectValue placeholder="Duration" />
      </SelectTrigger>
      <SelectContent>
        {durationParam.options.map((d) => (
          <SelectItem key={d} value={String(d)}>
            {d}s
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
