"use client"

import { useState, useEffect } from "react"
import { Prompt } from "@/app/dashboard/chat/[id]/client"
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
import { toast } from "sonner"
import { Input } from "@/components/ui/Input"

import styles from "./PromptBubble.module.scss"

interface PromptBubbleProps {
  prompt?: Prompt
  onGenerate?: (data: {
    text: string
    model: Prompt["model"]
    generationType: Prompt["generation_type"]
    files: File[]
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
      }[]
      newFiles: File[]
    },
  ) => Promise<void>
  onDelete?: (promptId: string) => Promise<void>
}

export default function PromptBubble({
  prompt,
  onGenerate,
  onEdit,
  onDelete,
}: PromptBubbleProps) {
  const isNew = !prompt
  const [mode, setMode] = useState<"view" | "edit" | "input" | "loading">(
    isNew ? "input" : "view",
  )
  const [text, setText] = useState("")
  const [model, setModel] = useState<Prompt["model"]>("gen4_turbo")
  const [generationType, setGenerationType] =
    useState<Prompt["generation_type"]>("video")
  const [existingMedia, setExistingMedia] = useState<
    { id: string; path: string; url: string; type: "image" | "video" }[]
  >([])
  const [newFiles, setNewFiles] = useState<File[]>([])

  useEffect(() => {
    if (model === "upscale_v1") {
      setText("")
      setGenerationType("video")
    }
  }, [model])

  const handleEnterEdit = () => {
    if (!prompt) return
    setText(prompt.prompt_text)
    setModel(prompt.model ?? "gen4_turbo")
    setGenerationType(prompt.generation_type ?? "video")
    setExistingMedia(prompt.media?.filter((m) => m.category === "input") ?? [])
    setNewFiles([])
    setMode("edit")
  }

  const handleCancel = () => {
    setMode("view")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMode("loading")
    try {
      if (isNew) {
        if (!onGenerate) return
        await onGenerate({ text, model, generationType, files: newFiles })
        setText("")
        setNewFiles([])
        setModel("gen4_turbo")
        setGenerationType("video")
        setMode("input")
      } else {
        if (!onEdit || !prompt) return
        await onEdit(prompt.id, {
          text,
          model,
          generationType,
          existingMedia,
          newFiles,
        })
        setMode("view")
      }
    } catch (err) {
      toast.error((err as Error).message)
      setMode(isNew ? "input" : "edit")
    }
  }

  const handleRemoveExisting = (index: number) => {
    setExistingMedia((prev) => prev.filter((_, i) => i !== index))
  }

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
            <Select
              value={model ?? ""}
              onValueChange={(v) => setModel(v as typeof model)}
            >
              <SelectTrigger className={styles.selectModel}>
                <SelectValue placeholder="Model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gen4_aleph">Gen-4 Aleph</SelectItem>
                <SelectItem value="gen4_turbo">Gen-4 Turbo</SelectItem>
                <SelectItem value="gen4_image">Gen-4 Image</SelectItem>
                <SelectItem value="gen4_image_turbo">Gen-4 Image Turbo</SelectItem>
                <SelectItem value="act_two">Act-Two</SelectItem>
                <SelectItem value="upscale_v1">Upscale V1</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={generationType ?? ""}
              onValueChange={(v) =>
                setGenerationType(v as typeof generationType)
              }
              disabled={model === "upscale_v1"}
            >
              <SelectTrigger className={styles.selectType}>
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="image">Image</SelectItem>
                <SelectItem value="video">Video</SelectItem>
              </SelectContent>
            </Select>
            {!isNew && (
              <div>
                <p>Existing Inputs:</p>
                {existingMedia.map((media, index) => (
                  <div key={index} className={styles.existingMediaItem}>
                    {media.type === "image" ? (
                      <img
                        src={media.url}
                        alt="Input"
                        className={styles.smallMediaImage}
                      />
                    ) : (
                      <video
                        src={media.url}
                        controls
                        className={styles.smallMediaVideo}
                      />
                    )}
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
            <Input
              type="file"
              multiple
              accept="image/*,video/*"
              onChange={(e) => setNewFiles(Array.from(e.target.files || []))}
            />
            {model !== "upscale_v1" && (
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={
                  isNew ? "Enter your prompt..." : "Edit your prompt..."
                }
              />
            )}
            <div className={styles.formButtons}>
              <Button type="submit">
                {isNew ? "Generate" : "Save and Re-generate"}
              </Button>
              {!isNew && (
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
