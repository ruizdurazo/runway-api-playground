"use client"

import { useState, useEffect, useMemo } from "react"

import { Prompt } from "@/app/dashboard/chat/[id]/client"

import { toast } from "sonner"

import { Textarea } from "@/components/ui/Textarea"
import { Button } from "@/components/ui/Button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select"
import { Card, CardContent } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/ToggleGroup"

import styles from "./PromptBubble.module.scss"

interface PromptBubbleProps {
  id?: string
  prompt?: Prompt
  onGenerate?: (data: {
    text: string
    model: Prompt["model"]
    generationType: Prompt["generation_type"]
    filesWithTags: { file: File; tag: string }[]
    ratio: string
  }) => Promise<void>
  onEdit?: (
    promptId: string,
    data: {
      text: string
      model: Prompt["model"]
      generationType: Prompt["generation_type"]
      existingMedia: {
        id: string
        path: string
        url: string
        type: "image" | "video"
        tag: string
      }[]
      newFilesWithTags: { file: File; tag: string }[]
      ratio: string
    },
  ) => Promise<Prompt>
  onDelete?: (promptId: string) => Promise<void>
  onRegenerate?: (promptId: string, freshPrompt?: Prompt) => Promise<void>
}

export default function PromptBubble({
  id,
  prompt,
  onGenerate,
  onEdit,
  onDelete,
  onRegenerate,
}: PromptBubbleProps) {
  // Move model lists to the top for use in initializers
  const videoModels = [
    { value: "gen4_turbo", label: "Gen-4 Turbo" },
    { value: "gen4_aleph", label: "Gen-4 Aleph" },
    { value: "act_two", label: "Act-Two" },
    { value: "upscale_v1", label: "Upscale V1" },
    // { value: "veo3", label: "Veo 3" },
  ]

  const imageModels = [
    { value: "gen4_image", label: "Gen-4 Image" },
    { value: "gen4_image_turbo", label: "Gen-4 Image Turbo" },
    // { value: "gemini_2.5_flash", label: "Gemini 2.5 Flash" },
  ]

  const videoRatios = [
    // horizontal
    "1280:720",
    "1280:768",
    "1104:832",
    "1584:672",
    // square
    "960:960",
    // vertical
    "720:1280",
    "768:1280",
    "832:1104",
  ]

  const imageRatios = [
    // horizontal
    "1920:1080",
    "1440:1080",
    "1808:768",
    "1360:768",
    "1680:720",
    "1280:720",
    "960:720",
    "2112:912",
    "1168:880",
    // square
    "1080:1080",
    "1024:1024",
    "720:720",
    // vertical
    "1080:1920",
    "1080:1440",
    "720:1280",
    "720:960",
  ]

  let initialGenerationType: Prompt["generation_type"] = "video"
  let initialModel: Prompt["model"] = "gen4_turbo"

  if (prompt) {
    initialGenerationType = prompt.generation_type ?? "video"
    initialModel = prompt.model ?? "gen4_turbo"
  }

  const isExisting = !!prompt
  const [mode, setMode] = useState<"view" | "edit" | "input" | "loading">(
    isExisting ? "view" : "input",
  )
  // const isEditing = ["input", "edit"].includes(mode)

  const [text, setText] = useState("")
  const [model, setModel] = useState<Prompt["model"]>(initialModel)
  const [generationType, setGenerationType] = useState<
    Prompt["generation_type"]
  >(initialGenerationType)
  const [existingMedia, setExistingMedia] = useState<
    {
      id: string
      path: string
      url: string
      type: "image" | "video"
      tag: string
    }[]
  >([])
  const [newFiles, setNewFiles] = useState<
    { file: File; tag: string; preview: string }[]
  >([])
  const [ratio, setRatio] = useState("1280:720")
  const [showReferences, setShowReferences] = useState(false)

  useEffect(() => {
    if (!prompt && typeof window !== "undefined") {
      const savedType = localStorage.getItem("lastGenerationType") as
        | Prompt["generation_type"]
        | null
      let newType = generationType
      if (savedType && ["video", "image"].includes(savedType)) {
        newType = savedType
        setGenerationType(savedType)
      }

      const validModels = newType === "video" ? videoModels : imageModels

      const savedModel = localStorage.getItem("lastModel") as
        | Prompt["model"]
        | null
      if (savedModel && validModels.some((m) => m.value === savedModel)) {
        setModel(savedModel)
      } else {
        setModel(validModels[0].value as typeof model)
      }
    }
  }, []) // Run once on mount

  useEffect(() => {
    if (model === "upscale_v1") {
      setText("")
      setGenerationType("video")
    }
  }, [model])

  useEffect(() => {
    if (!prompt && model) {
      localStorage.setItem("lastModel", model)
    }
  }, [model, prompt])

  useEffect(() => {
    if (!prompt && generationType) {
      localStorage.setItem("lastGenerationType", generationType)
      // update the saved model to the first valid model for the new generation type (video or image)
      if (![...videoModels, ...imageModels].some((m) => m.value === model)) {
        setModel(
          generationType === "video"
            ? (videoModels[0].value as typeof model)
            : (imageModels[0].value as typeof model),
        )
      } else {
        setModel(model)
      }
    }
  }, [generationType, prompt])

  useEffect(() => {
    const validModels = generationType === "video" ? videoModels : imageModels
    if (model && !validModels.some((m) => m.value === model)) {
      setModel(validModels[0].value as typeof model)
    }
  }, [generationType])

  const availableRatios = useMemo(() => {
    if (!model || !generationType) return []
    if (generationType === "video" && model === "upscale_v1") return []
    return generationType === "video" ? videoRatios : imageRatios
  }, [model, generationType])

  useEffect(() => {
    if (availableRatios.length > 0 && !availableRatios.includes(ratio)) {
      setRatio(availableRatios[0])
    }
  }, [availableRatios, ratio])

  const handleEnterEdit = () => {
    if (!prompt) return
    setText(prompt.prompt_text)
    setModel(prompt.model ?? "gen4_turbo")
    setGenerationType(prompt.generation_type ?? "video")
    setExistingMedia(
      prompt.media
        ?.filter((m) => m.category === "input")
        .map((m) => ({
          ...m,
          tag: m.tag ?? "",
        })) ?? [],
    )
    setNewFiles([])
    setMode("edit")
  }

  const handleCancel = () => {
    setMode("view")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const totalInputs =
      (isExisting && mode === "edit" ? existingMedia.length : 0) +
      newFiles.length
    const maxAllowed = model === "upscale_v1" ? 1 : 3
    if (totalInputs > maxAllowed) {
      toast.error(
        `Maximum of ${maxAllowed} reference images allowed for ${model}`,
      )
      return
    }
    if (model === "upscale_v1" && totalInputs !== 1) {
      toast.error("Upscale requires exactly one video input")
      return
    }

    if (!isExisting) {
      // Reset form immediately for new prompts
      const generateData = {
        text,
        model,
        generationType,
        filesWithTags: newFiles.map(({ file, tag }) => ({ file, tag })),
        ratio,
      }
      setText("")
      setNewFiles([])
      try {
        if (onGenerate) {
          await onGenerate(generateData)
          localStorage.setItem("lastModel", model!)
          localStorage.setItem("lastGenerationType", generationType!)
        }
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
          existingMedia,
          newFilesWithTags: newFiles.map(({ file, tag }) => ({ file, tag })),
          ratio,
        })
        await onRegenerate(prompt.id, updatedPrompt)
        setMode("view")
      } catch (err) {
        toast.error((err as Error).message)
        setMode("edit")
      }
    }
  }

  const handleRemoveExisting = (index: number) => {
    setExistingMedia((prev) => prev.filter((_, i) => i !== index))
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    const currentCount =
      (mode === "edit" ? existingMedia.length : 0) + newFiles.length
    const maxAllowed = model === "upscale_v1" ? 1 : 3
    const availableSlots = maxAllowed - currentCount
    if (availableSlots <= 0) {
      toast.error(`Maximum inputs reached (${maxAllowed})`)
      return
    }
    const toAdd = selectedFiles.slice(0, availableSlots)
    const newPreviews = toAdd.map((file) => ({
      file,
      tag: "",
      preview: URL.createObjectURL(file),
    }))
    setNewFiles((prev) => [...prev, ...newPreviews])
    if (toAdd.length < selectedFiles.length) {
      toast.error(
        `${toAdd.length > 1 ? `${toAdd.length} references added. Maximum is ${maxAllowed}.` : `${toAdd.length} reference added. Maximum is ${maxAllowed}.`}`,
      )
    }
  }

  const handleRemoveNew = (index: number) => {
    setNewFiles((prev) => {
      const removed = prev[index]
      URL.revokeObjectURL(removed.preview)
      return prev.filter((_, i) => i !== index)
    })
  }

  const handleTagChange = (
    index: number,
    newTag: string,
    isExisting: boolean,
  ) => {
    if (isExisting) {
      setExistingMedia((prev) => {
        const newList = [...prev]
        newList[index].tag = newTag
        return newList
      })
    } else {
      setNewFiles((prev) => {
        const newList = [...prev]
        newList[index].tag = newTag
        return newList
      })
    }
  }

  const currentCount =
    (!isExisting ? 0 : existingMedia.length) + newFiles.length
  const maxAllowed = model === "upscale_v1" ? 1 : 3

  let outputs: Prompt["media"] = []
  if (prompt && (mode === "view" || mode === "input" || mode === "edit")) {
    outputs = prompt.media?.filter((m) => m.category === "output") ?? []
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData.items
    const newPastedFiles: { file: File; tag: string; preview: string }[] = []
    let availableSlots = maxAllowed - currentCount

    for (const item of items) {
      if (availableSlots <= 0) break
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const file = item.getAsFile()
        if (file) {
          newPastedFiles.push({
            file,
            tag: "",
            preview: URL.createObjectURL(file),
          })
          availableSlots--
        }
      }
    }

    if (newPastedFiles.length > 0) {
      setNewFiles((prev) => [...prev, ...newPastedFiles])
      if (newPastedFiles.length < items.length) {
        // Approximate check
        toast.error(`Reference added. Maximum is ${maxAllowed}.`)
      }
    }
    // Do not preventDefault to allow text pasting
  }

  return (
    <Card
      className={`${styles.promptCard} ${mode === "input" ? styles.inputMode : ""}`}
    >
      <CardContent className={styles.promptContent}>
        {mode === "loading" ? (
          // {/* Loading state */}
          <div className={styles.loadingContainer}>
            {/* {(existingMedia.length > 0 || newFiles.length > 0) && (
              <div className={styles.inputSection}>
                <p className={styles.sectionTitle}>Inputs:</p>
                {existingMedia.map((m, index) => (
                  <div key={`existing-${index}`}>
                    {m.tag && <p>Tag: {m.tag}</p>}
                    {m.type === "image" ? (
                      <img
                        src={m.url}
                        alt=""
                        className={styles.mediaImage}
                      />
                    ) : (
                      <video
                        src={m.url}
                        controls
                        className={styles.mediaVideo}
                      />
                    )}
                  </div>
                ))}
                {newFiles.map((item, index) => (
                  <div key={`new-${index}`}>
                    {item.tag && <p>Tag: {item.tag}</p>}
                    {item.file.type.startsWith("image/") ? (
                      <img
                        src={item.preview}
                        alt=""
                        className={styles.mediaImage}
                      />
                    ) : (
                      <video
                        src={item.preview}
                        controls
                        className={styles.mediaVideo}
                      />
                    )}
                  </div>
                ))}
              </div>
            )} */}
            <div className={styles.outputSection}>
              <p className={styles.loadingText}>Generating...</p>
            </div>
          </div>
        ) : mode === "view" && prompt ? (
          // {/* View state */}
          <div className={styles.viewContainer}>
            {/* Output */}
            <div className={styles.outputSection}>
              {outputs.length > 0 ? (
                outputs.map((m, index) => (
                  <div key={index}>
                    {m.type === "image" ? (
                      <img
                        id={m.id}
                        src={m.url}
                        alt=""
                        className={styles.outputImage}
                      />
                    ) : (
                      <video
                        id={m.id}
                        src={m.url}
                        autoPlay
                        loop
                        muted
                        className={styles.outputVideo}
                      />
                    )}
                  </div>
                ))
              ) : (
                // {/* Loading state */}
                <p className={styles.loadingText}>Generating...</p>
              )}
            </div>

            {/* Input */}
            <div className={styles.inputSection}>
              {/* Reference images */}
              {prompt.media?.some((m) => m.category === "input") && (
                <div className={styles.inputMediaList}>
                  {prompt.media
                    .filter((m) => m.category === "input")
                    .map((m, index) => (
                      <div key={index} className={styles.inputMediaItem}>
                        {/* {m.tag && <p>Tag: {m.tag}</p>} */}
                        {m.type === "image" ? (
                          <img
                            src={m.url}
                            alt=""
                            className={styles.inputImage}
                          />
                        ) : (
                          <video
                            src={m.url}
                            autoPlay
                            loop
                            muted
                            className={styles.inputVideo}
                          />
                        )}
                      </div>
                    ))}
                </div>
              )}
              {/* Prompt */}
              <p className={styles.promptText}>{prompt.prompt_text}</p>
            </div>

            <Button
              className={styles.editButton}
              size="sm"
              onClick={handleEnterEdit}
            >
              Edit
            </Button>
          </div>
        ) : (
          // {/* Input (and edit) state */}
          <div
            className={`${styles.promptContainer} ${mode === "input" ? styles.inputMode : ""}`}
          >
            {/* Output (if any) */}
            {mode === "edit" && (
              <div
                className={`${styles.outputSection} ${mode === "edit" ? styles.editMode : ""}`}
              >
                {outputs.length > 0 &&
                  outputs.map((m, index) => (
                    <div key={index}>
                      {m.type === "image" ? (
                        <img
                          id={m.id}
                          src={m.url}
                          alt=""
                          className={styles.outputImage}
                        />
                      ) : (
                        <video
                          id={m.id}
                          src={m.url}
                          autoPlay
                          loop
                          muted
                          className={styles.outputVideo}
                        />
                      )}
                    </div>
                  ))}
              </div>
            )}

            {/* Input (and edit) form */}
            <form
              className={`${mode === "input" ? styles.inputForm : styles.editForm}`}
              onSubmit={handleSubmit}
            >
              {/* Reference images */}
              {(isExisting || showReferences) && existingMedia.length > 0 && (
                <div className={styles.mediaPreviewList}>
                  {/* <p>Existing Inputs:</p> */}
                  {existingMedia.map((m, index) => (
                    <div key={index} className={styles.mediaItem}>
                      {m.type === "image" ? (
                        <img
                          src={m.url}
                          alt=""
                          className={styles.previewMedia}
                        />
                      ) : (
                        <video src={m.url} className={styles.previewMedia} />
                      )}
                      {imageModels.some((m) => m.value === model) && (
                        <>
                          <Input
                            value={m.tag}
                            onChange={(e) =>
                              handleTagChange(index, e.target.value, true)
                            }
                            placeholder="Tag"
                            className={styles.tagInput}
                          />
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleRemoveExisting(index)}
                          >
                            Remove
                          </Button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* File Input */}
              {currentCount < maxAllowed && showReferences && (
                <Input
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  onChange={handleFileChange}
                />
              )}

              {newFiles.length > 0 && (
                <div className={styles.mediaPreviewList}>
                  {/* <p>New Inputs:</p> */}
                  {newFiles.map((item, index) => (
                    <div key={index} className={styles.mediaItem}>
                      {item.file.type.startsWith("image/") ? (
                        <img
                          src={item.preview}
                          alt=""
                          className={styles.previewMedia}
                        />
                      ) : (
                        <video
                          src={item.preview}
                          className={styles.previewMedia}
                        />
                      )}
                      <Input
                        value={item.tag}
                        onChange={(e) =>
                          handleTagChange(index, e.target.value, false)
                        }
                        placeholder="Tag"
                        className={styles.tagInput}
                      />
                      <Button
                        className={styles.removeButton}
                        size="sm"
                        onClick={() => handleRemoveNew(index)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Prompt text area */}
              {model !== "upscale_v1" && (
                <Textarea
                  value={text}
                  name="prompt"
                  onChange={(e) => setText(e.target.value)}
                  onPaste={handlePaste}
                  placeholder={
                    !isExisting ? "Enter your prompt..." : "Edit your prompt..."
                  }
                />
              )}

              {/* Prompt controls */}
              <div className={styles.promptControls}>
                {/* Prompt settings */}
                <div className={styles.promptSettings}>
                  {/* Generation type */}
                  <ToggleGroup
                    type="single"
                    value={generationType}
                    onValueChange={(value) => {
                      if (value) {
                        setGenerationType(value as typeof generationType)
                      }
                    }}
                  >
                    <ToggleGroupItem value="video">Video</ToggleGroupItem>
                    <ToggleGroupItem value="image">Image</ToggleGroupItem>
                  </ToggleGroup>

                  {/* Model */}
                  <Select
                    value={model ?? ""}
                    onValueChange={(v) => setModel(v as typeof model)}
                  >
                    <SelectTrigger className={styles.selectModel}>
                      <SelectValue placeholder="Model" />
                    </SelectTrigger>
                    <SelectContent>
                      {(generationType === "video"
                        ? videoModels
                        : imageModels
                      ).map(({ value, label }) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Aspect ratio */}
                  {availableRatios.length > 0 && (
                    <Select value={ratio} onValueChange={setRatio}>
                      <SelectTrigger className={styles.selectModel}>
                        <SelectValue placeholder="Select aspect ratio" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableRatios.map((r) => (
                          <SelectItem key={r} value={r}>
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {/* References button */}
                  <Button
                    variant="outline"
                    onClick={() => setShowReferences(true)}
                  >
                    + References
                  </Button>
                </div>

                {/* Generate button */}
                <div className={styles.formButtons}>
                  <Button className={styles.generateButton} type="submit">
                    ↑ Generate
                  </Button>
                  {/* if existing, show delete button */}
                  {isExisting && (
                    <Button
                      className={styles.deleteButton}
                      onClick={() => onDelete?.(prompt.id)}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            </form>

            {/* Cancel button */}
            {isExisting && (
              <Button className={styles.cancelButton} onClick={handleCancel}>
                Cancel
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
