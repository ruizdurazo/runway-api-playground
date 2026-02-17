"use client"

import { Button } from "@/components/ui/Button"
import { usePromptContext } from "./context"

import styles from "./prompt.module.scss"

/**
 * Action buttons: Generate, Delete, Edit, Cancel.
 * Renders the appropriate set based on the current mode.
 */
export default function PromptActions() {
  const { mode, setMode, prompt, onDelete, onSubmit, setExistingMedia, setText, setGenerationType, setModel, setRatio } =
    usePromptContext()

  // ---- View mode: Edit button ----
  if (mode === "view" && prompt) {
    const handleEnterEdit = () => {
      setText(prompt.prompt_text)
      setGenerationType(prompt.generation_type ?? "video")
      setModel(prompt.model)
      setRatio(prompt.ratio)
      setExistingMedia(
        prompt.media
          ?.filter((m) => m.category === "input")
          .map((m) => ({ ...m, tag: m.tag ?? "", position: null })) ?? [],
      )
      setMode("edit")
    }

    return (
      <Button
        type="button"
        className={styles.editButton}
        size="sm"
        onClick={handleEnterEdit}
      >
        Edit
      </Button>
    )
  }

  // ---- Loading mode: nothing ----
  if (mode === "loading") return null

  // ---- Input / Edit mode ----
  const isExisting = !!prompt

  return (
    <div className={styles.promptActions}>
      <Button className={styles.generateButton} type="submit">
        ↑ Generate
      </Button>
      {isExisting && (
        <Button
          type="button"
          className={styles.deleteButton}
          onClick={() => onDelete?.(prompt.id)}
        >
          Delete
        </Button>
      )}
    </div>
  )
}
