"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { toast } from "sonner"

import { MODEL_REGISTRY, getModelsByGenerationType, isValidModel, resolveModel } from "@/lib/models/registry"
import type { Model } from "@/lib/models/registry"
import type { GenerationType, ModelDefinition } from "@/lib/models/types"
import { validateModelInputs } from "@/lib/models/validation"
import type { Prompt, MediaItem, GeneratePayload, EditPayload } from "@/lib/types"

import { PromptContext, type FileWithPreview } from "./context"
import { Card, CardContent } from "@/components/ui/Card"

import styles from "./prompt.module.scss"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PromptRootProps {
  /** Pre-existing prompt (enables view/edit modes). */
  prompt?: Prompt
  /** ID attribute for the DOM element. */
  id?: string
  /** Called when creating a new generation. */
  onGenerate?: (data: GeneratePayload) => Promise<void>
  /** Called when editing an existing prompt. */
  onEdit?: (promptId: string, data: EditPayload) => Promise<Prompt>
  /** Called to delete a prompt. */
  onDelete?: (promptId: string) => Promise<void>
  /** Called to regenerate from an existing prompt. */
  onRegenerate?: (promptId: string, freshPrompt?: Prompt) => Promise<void>
  children: React.ReactNode
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PromptRoot({
  prompt,
  id,
  onGenerate,
  onEdit,
  onDelete,
  onRegenerate,
  children,
}: PromptRootProps) {
  const isExisting = !!prompt

  // ---- Resolve initial values from prompt (server-safe, no localStorage) ----
  const resolveFromPrompt = (): { model: Model; generationType: GenerationType } => {
    if (prompt) {
      const gt = prompt.generation_type ?? "video"
      // Resolve aliases (e.g. "veo3_text" -> "veo3") and validate
      let m: Model = "gen4_turbo"
      try {
        m = resolveModel(prompt.model)
      } catch {
        // Unknown model in DB -- fall through to default
      }
      const validModels = getModelsByGenerationType(gt)
      if (!validModels.some((vm) => vm.id === m)) {
        m = validModels[0]?.id ?? "gen4_turbo"
      }
      return { model: m, generationType: gt }
    }
    // Server-safe default -- localStorage is synced after mount via useEffect
    return { model: "gen4_turbo", generationType: "video" }
  }

  const initials = resolveFromPrompt()

  // ---- State ---------------------------------------------------------------
  const [mode, setMode] = useState<"view" | "edit" | "input" | "loading">(
    isExisting ? "view" : "input",
  )
  const [model, setModelRaw] = useState<Model>(initials.model)
  const [generationType, setGenerationTypeRaw] = useState<GenerationType>(
    initials.generationType,
  )
  const [text, setText] = useState("")
  const [existingMedia, setExistingMedia] = useState<
    (MediaItem & { position: "first" | "last" | null })[]
  >([])
  const [newFiles, setNewFiles] = useState<FileWithPreview[]>([])
  const [ratio, setRatio] = useState(
    prompt?.ratio ?? MODEL_REGISTRY[initials.model]?.ratios[0] ?? "1280:720",
  )
  const [showReferences, setShowReferences] = useState(false)

  // Hydrate from localStorage after mount (new prompts only)
  useEffect(() => {
    if (prompt) return
    const savedType = localStorage.getItem("lastGenerationType") as GenerationType | null
    const gt: GenerationType =
      savedType && ["video", "image"].includes(savedType) ? savedType : "video"
    const validModels = getModelsByGenerationType(gt)
    const savedModel = localStorage.getItem("lastModel")
    // Only use saved model if it's a valid key in the current registry
    const m =
      savedModel && isValidModel(savedModel) && validModels.some((vm) => vm.id === resolveModel(savedModel))
        ? resolveModel(savedModel)
        : validModels[0]?.id ?? "gen4_turbo"
    setGenerationTypeRaw(gt)
    setModelRaw(m)
    const config = MODEL_REGISTRY[m]
    if (config?.ratios.length > 0) setRatio(config.ratios[0] as string)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- Derived config (with fallback to prevent crashes on unknown models) --
  const modelConfig: ModelDefinition =
    MODEL_REGISTRY[model] ?? MODEL_REGISTRY["gen4_turbo"]

  const maxInputCount = useMemo(() => {
    const inputs = modelConfig.inputs
    if (inputs.kind === "standard") return inputs.maxCount
    if (inputs.kind === "named") {
      return Object.values(inputs.slots).reduce((sum, s) => sum + s.maxCount, 0)
    }
    return 0
  }, [modelConfig])

  const currentInputCount =
    (!isExisting ? 0 : existingMedia.length) + newFiles.length

  const outputs: MediaItem[] = useMemo(() => {
    if (!prompt?.media) return []
    return prompt.media.filter((m) => m.category === "output")
  }, [prompt?.media])

  // Aspect ratio for dynamic card width (view / loading modes)
  const mediaAspectRatio = useMemo(() => {
    const r = prompt?.ratio ?? ratio
    if (!r) return null
    const [w, h] = r.split(":").map(Number)
    if (!w || !h) return null
    return w / h
  }, [prompt?.ratio, ratio])

  const isMediaSized =
    (mode === "view" || mode === "loading") && mediaAspectRatio !== null

  // ---- Sync model <-> generationType --------------------------------------
  const setModel = useCallback(
    (m: Model) => {
      // Resolve aliases and validate before setting
      let resolved: Model = m
      if (!isValidModel(m)) {
        resolved = "gen4_turbo"
      } else {
        try { resolved = resolveModel(m) } catch { resolved = "gen4_turbo" }
      }
      setModelRaw(resolved)
      if (resolved === "upscale_v1") {
        setText("")
        setGenerationTypeRaw("video")
      }
    },
    [],
  )

  const setGenerationType = useCallback(
    (gt: GenerationType) => {
      setGenerationTypeRaw(gt)
    },
    [],
  )

  // Ensure model is always valid for the current generation type
  useEffect(() => {
    const validModels = getModelsByGenerationType(generationType)
    if (!validModels.some((vm) => vm.id === model)) {
      setModelRaw(validModels[0]?.id ?? "gen4_turbo")
    }
  }, [generationType, model])

  // Keep ratio in sync when model changes
  useEffect(() => {
    const ratios = modelConfig.ratios
    if (ratios.length > 0 && !ratios.includes(ratio)) {
      setRatio(ratios[0] as string)
    }
  }, [modelConfig, ratio])

  // Persist to localStorage for new prompts
  useEffect(() => {
    if (!prompt && model) localStorage.setItem("lastModel", model)
  }, [model, prompt])

  useEffect(() => {
    if (!prompt && generationType)
      localStorage.setItem("lastGenerationType", generationType)
  }, [generationType, prompt])

  // Clear invalid tags when model changes
  useEffect(() => {
    if (modelConfig.inputs.kind === "standard" && !modelConfig.inputs.tagsAllowed) {
      setNewFiles((prev) => prev.map((f) => ({ ...f, tag: "" })))
    }
  }, [modelConfig])

  // Auto-assign position "first" when switching to a model that requires positions
  useEffect(() => {
    if (
      modelConfig.inputs.kind === "standard" &&
      modelConfig.inputs.positionsRequired
    ) {
      setNewFiles((prev) =>
        prev.map((f) => (f.position ? f : { ...f, position: "first" })),
      )
      setExistingMedia((prev) =>
        prev.map((m) => (m.position ? m : { ...m, position: "first" })),
      )
    }
  }, [modelConfig])

  // ---- File management -----------------------------------------------------
  const addFiles = useCallback(
    (files: File[]) => {
      const available =
        maxInputCount === Infinity ? files.length : maxInputCount - currentInputCount
      if (available <= 0) {
        toast.error(
          `Maximum inputs reached (${maxInputCount === Infinity ? "∞" : maxInputCount})`,
        )
        return
      }
      const toAdd = files.slice(0, available)
      const defaultPosition =
        modelConfig.inputs.kind === "standard" &&
        modelConfig.inputs.positionsRequired
          ? ("first" as const)
          : null
      const previews: FileWithPreview[] = toAdd.map((file) => ({
        file,
        tag: "",
        preview: URL.createObjectURL(file),
        position: defaultPosition,
      }))
      setNewFiles((prev) => [...prev, ...previews])
      if (toAdd.length < files.length) {
        toast.error(
          `Only ${toAdd.length} reference(s) added. Maximum is ${maxInputCount === Infinity ? "∞" : maxInputCount}.`,
        )
      }
    },
    [maxInputCount, currentInputCount, modelConfig],
  )

  const removeNewFile = useCallback((index: number) => {
    setNewFiles((prev) => {
      const removed = prev[index]
      if (removed) URL.revokeObjectURL(removed.preview)
      return prev.filter((_, i) => i !== index)
    })
  }, [])

  const removeExistingMedia = useCallback((index: number) => {
    setExistingMedia((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const updateTag = useCallback(
    (index: number, tag: string, isExisting: boolean) => {
      if (isExisting) {
        setExistingMedia((prev) => {
          const list = [...prev]
          list[index] = { ...list[index], tag }
          return list
        })
      } else {
        setNewFiles((prev) => {
          const list = [...prev]
          list[index] = { ...list[index], tag }
          return list
        })
      }
    },
    [],
  )

  // ---- Submit handler ------------------------------------------------------
  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()

      try {
        validateModelInputs(
          model,
          generationType,
          text,
          [
            ...existingMedia.map((m) => ({
              type: m.type,
              tag: m.tag,
              position: m.position ?? undefined,
            })),
            ...newFiles.map((f) => ({
              type: (f.file.type.startsWith("image/") ? "image" : "video") as
                | "image"
                | "video",
              tag: f.tag,
              position: f.position ?? undefined,
            })),
          ],
          ratio,
        )
      } catch (err) {
        toast.error((err as Error).message)
        return
      }

      if (currentInputCount > maxInputCount && maxInputCount !== Infinity) {
        toast.error(
          `Maximum of ${maxInputCount} inputs allowed for ${modelConfig.displayName}`,
        )
        return
      }

      if (!isExisting) {
        const payload: GeneratePayload = {
          text,
          model,
          generationType,
          filesWithTags: newFiles.map(({ file, tag, position }) => ({
            file,
            tag,
            position,
          })),
          ratio,
        }
        setText("")
        setNewFiles([])
        try {
          await onGenerate?.(payload)
          localStorage.setItem("lastModel", model)
          localStorage.setItem("lastGenerationType", generationType)
        } catch (err) {
          toast.error((err as Error).message)
        }
      } else {
        setMode("loading")
        try {
          if (!onEdit || !prompt || !onRegenerate) return
          const updatedPrompt = await onEdit(prompt.id, {
            text,
            model,
            generationType,
            existingMedia: existingMedia.map((m) => ({
              id: m.id,
              path: m.path,
              url: m.url,
              type: m.type,
              tag: m.tag,
              position: m.position,
            })),
            newFilesWithTags: newFiles.map(({ file, tag, position }) => ({
              file,
              tag,
              position,
            })),
            ratio,
          })
          await onRegenerate(prompt.id, updatedPrompt)
          setMode("view")
        } catch (err) {
          toast.error((err as Error).message)
          setMode("edit")
        }
      }
    },
    [
      model,
      generationType,
      text,
      existingMedia,
      newFiles,
      ratio,
      currentInputCount,
      maxInputCount,
      modelConfig.displayName,
      isExisting,
      onGenerate,
      onEdit,
      onRegenerate,
      prompt,
    ],
  )

  // ---- Context value -------------------------------------------------------
  const contextValue: import("./context").PromptContextValue = {
    mode,
    setMode,
    model,
    setModel,
    modelConfig,
    generationType,
    setGenerationType,
    text,
    setText,
    existingMedia,
    setExistingMedia,
    newFiles,
    addFiles,
    removeNewFile,
    removeExistingMedia,
    updateTag,
    ratio,
    setRatio,
    showReferences,
    setShowReferences,
    maxInputCount,
    currentInputCount,
    prompt,
    outputs,
    onSubmit,
    onDelete,
    onRegenerate,
  }

  // ---- Render with mode-appropriate layout ---------------------------------
  const renderContent = () => {
    if (mode === "loading") {
      return <div className={styles.loadingContainer}>{children}</div>
    }

    if (mode === "view") {
      return <div className={styles.viewContainer}>{children}</div>
    }

    // input / edit
    return (
      <div
        className={`${styles.promptContainer} ${mode === "input" ? styles.inputMode : ""}`}
      >
        {mode === "edit" && (
          <button
            type="button"
            className={styles.cancelButton}
            onClick={() => setMode("view")}
          >
            Cancel
          </button>
        )}
        <form
          className={mode === "input" ? styles.inputForm : styles.editForm}
          onSubmit={onSubmit}
        >
          {children}
        </form>
      </div>
    )
  }

  return (
    <PromptContext.Provider value={contextValue}>
      <Card
        id={id}
        className={`${styles.promptCard} ${mode === "input" ? styles.inputMode : ""} ${isMediaSized ? styles.mediaSized : ""}`}
        style={
          isMediaSized
            ? ({ "--media-aspect-ratio": mediaAspectRatio } as React.CSSProperties)
            : undefined
        }
      >
        <CardContent className={styles.promptContent}>
          {renderContent()}
        </CardContent>
      </Card>
    </PromptContext.Provider>
  )
}
