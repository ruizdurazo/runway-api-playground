"use client"

import { Input } from "@/components/ui/Input"
import { Button } from "@/components/ui/Button"
import { usePromptContext } from "./context"

import styles from "./prompt.module.scss"

/**
 * File upload area + reference toggle button.
 * Adapts accepted file types, max count, etc. from the model config in context.
 */
export default function PromptMediaInput() {
  const {
    mode,
    modelConfig,
    showReferences,
    setShowReferences,
    currentInputCount,
    maxInputCount,
    addFiles,
  } = usePromptContext()

  if (mode === "view" || mode === "loading") return null
  if (modelConfig.inputs.kind === "none") return null

  const accept =
    modelConfig.inputs.kind === "standard"
      ? (modelConfig.inputs.allowedFileTypes as string[]).join(",")
      : "*/*"

  const canAddMore =
    maxInputCount === Infinity || currentInputCount < maxInputCount

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) addFiles(files)
    // Reset the input so the same file can be re-selected
    e.target.value = ""
  }

  return (
    <>
      {!showReferences && maxInputCount > 0 && (
        <Button
          type="button"
          className={styles.referencesButton}
          onClick={() => setShowReferences(true)}
        >
          + Reference
        </Button>
      )}

      {showReferences && canAddMore && (
        <Input
          type="file"
          multiple
          accept={accept}
          onChange={handleFileChange}
        />
      )}
    </>
  )
}
