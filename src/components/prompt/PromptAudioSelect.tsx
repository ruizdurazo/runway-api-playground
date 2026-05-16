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
 * Veo 3.1 / 3.1 Fast: optional generated audio (affects pricing per Runway API).
 */
export default function PromptAudioSelect() {
  const { mode, modelConfig, generationOptions, setGenerationOptions } =
    usePromptContext()

  if (mode === "view" || mode === "loading") return null

  const audioParam = modelConfig.additionalParams?.audio
  if (!audioParam) return null

  const value =
    generationOptions.audio !== undefined
      ? String(generationOptions.audio)
      : String(audioParam.default)

  return (
    <Select
      value={value}
      onValueChange={(v) =>
        setGenerationOptions((prev) => ({
          ...prev,
          audio: v === "true",
        }))
      }
    >
      <SelectTrigger className={styles.selectInput}>
        <SelectValue placeholder="Audio" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="true">Audio on</SelectItem>
        <SelectItem value="false">Audio off</SelectItem>
      </SelectContent>
    </Select>
  )
}
