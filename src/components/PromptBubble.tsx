"use client"

import { useState, useEffect } from "react"

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
import { Label } from "@/components/ui/Label"

import styles from "./PromptBubble.module.scss"

interface PromptBubbleProps {
  prompt?: Prompt
  onGenerate?: (data: {
    text: string
    model: Prompt["model"]
    generationType: Prompt["generation_type"]
    filesWithTags: { file: File; tag: string }[]
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
    },
  ) => Promise<void>
  onDelete?: (promptId: string) => Promise<void>
  onRegenerate?: (promptId: string) => Promise<void>
}

export default function PromptBubble({
  prompt,
  onGenerate,
  onEdit,
  onDelete,
  onRegenerate,
}: PromptBubbleProps) {
  const isExisting = !!prompt
  const [mode, setMode] = useState<"view" | "edit" | "input" | "loading">(
    isExisting ? "view" : "input",
  )
  const isEditing = mode === "input" || mode === "edit"

  const [text, setText] = useState("")
  const [model, setModel] = useState<Prompt["model"]>("gen4_turbo")
  const [generationType, setGenerationType] =
    useState<Prompt["generation_type"]>("video")
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

  useEffect(() => {
    if (model === "upscale_v1") {
      setText("")
      setGenerationType("video")
    }
  }, [model])

  const videoModels = [
    { value: "gen4_aleph", label: "Gen-4 Aleph" },
    { value: "gen4_turbo", label: "Gen-4 Turbo" },
    { value: "act_two", label: "Act-Two" },
    { value: "upscale_v1", label: "Upscale V1" },
  ];

  const imageModels = [
    { value: "gen4_image", label: "Gen-4 Image" },
    { value: "gen4_image_turbo", label: "Gen-4 Image Turbo" },
  ];

  useEffect(() => {
    const validModels = generationType === "video" ? videoModels : imageModels;
    if (model && !validModels.some(m => m.value === model)) {
      setModel((validModels[0]?.value ?? undefined) as typeof model);
    }
  }, [generationType]);

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
    setMode("loading")
    try {
      if (!isExisting) {
        if (!onGenerate) return
        await onGenerate({
          text,
          model,
          generationType,
          filesWithTags: newFiles.map(({ file, tag }) => ({ file, tag })),
        })
        setText("")
        setNewFiles([])
        setModel("gen4_turbo")
        setGenerationType("video")
        setMode("input")
      } else {
        if (!onEdit || !prompt || !onRegenerate) return
        await onEdit(prompt.id, {
          text,
          model,
          generationType,
          existingMedia,
          newFilesWithTags: newFiles.map(({ file, tag }) => ({ file, tag })),
        })
        await onRegenerate(prompt.id)
        setMode("view")
      }
    } catch (err) {
      toast.error((err as Error).message)
      setMode(!isExisting ? "input" : "edit")
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
      toast.error(`Only ${toAdd.length} files added. Maximum is ${maxAllowed}.`)
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

  return (
    <Card>
      <CardContent className={styles.promptContent}>
        {mode === "loading" ? (
          <p className={styles.loadingText}>Generating...</p>
        ) : mode === "view" && prompt ? (
          <>
            {prompt.media?.some((m) => m.category === "input") && (
              <div className={styles.inputSection}>
                <p className={styles.sectionTitle}>Inputs:</p>
                {prompt.media
                  .filter((m) => m.category === "input")
                  .map((m, index) => (
                    <div key={index}>
                      {m.tag && <p>Tag: {m.tag}</p>}
                      {m.type === "image" ? (
                        <img
                          src={m.url}
                          alt="Input"
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
              </div>
            )}
            <p className={styles.promptText}>{prompt.prompt_text}</p>
            <div className={styles.outputSection}>
              {prompt.media
                ?.filter((m) => m.category === "output")
                .map((m, index) => (
                  <div key={index}>
                    {m.type === "image" ? (
                      <img
                        src={m.url}
                        alt="Generated"
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
            </div>
            <div className={styles.actionButtons}>
              <Button variant="outline" size="sm" onClick={handleEnterEdit}>
                Edit
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => onDelete?.(prompt.id)}
              >
                Delete
              </Button>
            </div>
          </>
        ) : (
          <form onSubmit={handleSubmit} className={styles.promptForm}>
            <div>
              <Label>Generate</Label>
              <ToggleGroup
                type="single"
                value={generationType}
                onValueChange={(value) => {
                  if (value) {
                    setGenerationType(value as typeof generationType)
                  }
                }}
                className={styles.selectType}
              >
                <ToggleGroupItem value="video">Video</ToggleGroupItem>
                <ToggleGroupItem value="image">Image</ToggleGroupItem>
              </ToggleGroup>
            </div>

            <div>
              <Label>Model</Label>
              <Select
                value={model ?? ""}
                onValueChange={(v) => setModel(v as typeof model)}
              >
                <SelectTrigger className={styles.selectModel}>
                  <SelectValue placeholder="Model" />
                </SelectTrigger>
                <SelectContent>
                  {(generationType === "video" ? videoModels : imageModels).map(({ value, label }) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>References</Label>
              {isExisting && (
                <div className={styles.mediaPreviewList}>
                  <p>Existing Inputs:</p>
                  {existingMedia.map((media, index) => (
                    <div key={index} className={styles.mediaItem}>
                      {media.type === "image" ? (
                        <img
                          src={media.url}
                          alt="Input"
                          className={styles.previewMedia}
                        />
                      ) : (
                        <video
                          src={media.url}
                          className={styles.previewMedia}
                        />
                      )}
                      <Input
                        value={media.tag}
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
                    </div>
                  ))}
                </div>
              )}

              {/* File Input */}
              {currentCount < maxAllowed && (
                <Input
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  onChange={handleFileChange}
                />
              )}

              {newFiles.length > 0 && (
                <div className={styles.mediaPreviewList}>
                  <p>New Inputs:</p>
                  {newFiles.map((item, index) => (
                    <div key={index} className={styles.mediaItem}>
                      {item.file.type.startsWith("image/") ? (
                        <img
                          src={item.preview}
                          alt="Preview"
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
                        variant="destructive"
                        size="sm"
                        onClick={() => handleRemoveNew(index)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Prompt */}
            {model !== "upscale_v1" && (
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={
                  !isExisting ? "Enter your prompt..." : "Edit your prompt..."
                }
              />
            )}

            {/* Buttons */}
            <div className={styles.formButtons}>
              <Button type="submit">Generate</Button>
              {isExisting && (
                <Button variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
