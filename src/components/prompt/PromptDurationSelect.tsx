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
): string[] | null {
  const numeric = durationParam.options?.filter(
    (option): option is number => typeof option === "number",
  )
  let values: string[] | null = null
  if (numeric && numeric.length > 0) {
    values = numeric.map(String)
  } else if (
    durationParam.min !== undefined &&
    durationParam.max !== undefined
  ) {
    const out: string[] = []
    for (let v = durationParam.min; v <= durationParam.max; v++) out.push(String(v))
    values = out
  }
  if (!values) return null
  if (durationParam.allowAuto) return ["auto", ...values]
  return values
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

  const defaultValue =
    durationParam.default === "auto"
      ? "auto"
      : String(
          typeof durationParam.default === "number" ? durationParam.default : 5,
        )
  const effective =
    generationOptions.duration === "auto"
      ? "auto"
      : typeof generationOptions.duration === "number"
        ? String(generationOptions.duration)
        : defaultValue

  return (
    <Select
      value={effective}
      onValueChange={(v) =>
        setGenerationOptions((prev) => ({
          ...prev,
          duration: v === "auto" ? "auto" : Number(v),
        }))
      }
    >
      <SelectTrigger className={styles.selectInput}>
        <SelectValue placeholder="Duration" />
      </SelectTrigger>
      <SelectContent>
        {optionValues.map((d) => (
          <SelectItem key={d} value={d}>
            {d === "auto" ? "Auto" : `${d}s`}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
