"use client"

import { useCallback, useState } from "react"
import { usePromptContext } from "./context"

import styles from "./prompt.module.scss"

/**
 * Full-width file picker styled as a dashed drop zone (matches native “add reference” UX).
 * Accepts multiple files; drag-and-drop supported.
 */
export default function PromptMediaInput() {
  const { mode, modelConfig, currentInputCount, maxInputCount, addFiles } =
    usePromptContext()

  const [isDragging, setIsDragging] = useState(false)

  const canAddMore =
    maxInputCount === Infinity || currentInputCount < maxInputCount

  const ingestFiles = useCallback(
    (files: File[]) => {
      if (files.length === 0) return
      const allowed =
        maxInputCount === Infinity || currentInputCount < maxInputCount
      if (!allowed) return
      addFiles(files)
    },
    [addFiles, currentInputCount, maxInputCount],
  )

  if (mode === "view" || mode === "loading") return null
  if (modelConfig.inputs.kind === "none") return null
  if (maxInputCount <= 0) return null
  if (!canAddMore) return null

  const accept =
    modelConfig.inputs.kind === "standard"
      ? (modelConfig.inputs.allowedFileTypes as string[]).join(",")
      : "*/*"

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    ingestFiles(files)
    e.target.value = ""
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer.types.includes("Files")) setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    const next = e.relatedTarget as Node | null
    if (next && e.currentTarget.contains(next)) return
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    ingestFiles(Array.from(e.dataTransfer.files || []))
  }

  return (
    <div
      className={`${styles.mediaDropZone} ${isDragging ? styles.mediaDropZoneDragging : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        type="file"
        className={styles.mediaDropZoneInput}
        multiple
        accept={accept}
        onChange={handleFileChange}
        aria-label="Add reference"
      />
      <span className={styles.mediaDropZoneLabel}>+ Add reference</span>
    </div>
  )
}
