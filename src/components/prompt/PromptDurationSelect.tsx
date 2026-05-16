"use client"

import type { ModelDefinition } from "@runway-playground/shared"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select"
import { usePromptContext } from "./context"

import styles from "./prompt.module.scss"

function durationOptionValues(
  durationParam: NonNullable<ModelDefinition["additionalParams"]>["duration"],
): number[] | null {
  if (durationParam.options && durationParam.options.length > 0) {
    return [...durationParam.options]
  }
  if (
    durationParam.min !== undefined &&
    durationParam.max !== undefined
  ) {
    const out: number[] = []
    for (let v = durationParam.min; v <= durationParam.max; v++) out.push(v)
    return out
  }
  return null
}

/**
 * Duration picker when the model exposes a configurable `duration` param.
 */
export default function PromptDurationSelect() {
  const { mode, modelConfig, generationOptions, setGenerationOptions } =
    usePromptContext()

  if (mode === "view" || mode === "loading") return null

  const durationParam = modelConfig.additionalParams?.duration
  if (!durationParam) return null

  const optionValues = durationOptionValues(durationParam)
  if (!optionValues || optionValues.length <= 1) return null

  const defaultNum =
    typeof durationParam.default === "number" ? durationParam.default : 8
  const effective =
    generationOptions.duration !== undefined &&
    typeof generationOptions.duration === "number"
      ? generationOptions.duration
      : defaultNum

  return (
    <Select
      value={String(effective)}
      onValueChange={(v) =>
        setGenerationOptions((prev) => ({
          ...prev,
          duration: Number(v),
        }))
      }
    >
      <SelectTrigger className={styles.selectInput}>
        <SelectValue placeholder="Duration" />
      </SelectTrigger>
      <SelectContent>
        {optionValues.map((d) => (
          <SelectItem key={d} value={String(d)}>
            {d}s
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
