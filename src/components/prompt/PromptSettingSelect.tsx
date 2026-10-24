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

const SETTING_LABELS: Record<string, string> = {
  resolution: "Resolution",
  mode: "Video mode",
}

const VALUE_LABELS: Record<string, string> = {
  reference: "Reference",
  extend: "Extend",
  edit: "Edit",
}

/**
 * String settings from the model registry, such as resolution and Seedance video mode.
 */
export default function PromptSettingSelect() {
  const { mode, modelConfig, generationOptions, setGenerationOptions } =
    usePromptContext()

  if (mode === "view" || mode === "loading") return null

  const params = modelConfig.additionalParams ?? {}
  const fields = Object.entries(params).filter(([, param]) => {
    return typeof param.default === "string" && param.options && param.options.length > 0
  })

  if (fields.length === 0) return null

  return (
    <>
      {fields.map(([key, param]) => {
        const value =
          typeof generationOptions[key] === "string"
            ? generationOptions[key]
            : String(param.default)
        return (
          <Select
            key={key}
            value={value}
            onValueChange={(next) =>
              setGenerationOptions((prev) => ({ ...prev, [key]: next }))
            }
          >
            <SelectTrigger className={styles.selectInput}>
              <SelectValue placeholder={SETTING_LABELS[key] ?? key} />
            </SelectTrigger>
            <SelectContent>
              {param.options?.map((option) => (
                <SelectItem key={String(option)} value={String(option)}>
                  {VALUE_LABELS[String(option)] ?? String(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )
      })}
    </>
  )
}
