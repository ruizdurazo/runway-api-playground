"use client"

import { useState, useEffect } from "react"
import { Prompt } from "@/app/dashboard/chat/[id]/page" // Assuming Prompt interface is exported from page.tsx, adjust if needed
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"

interface PromptBubbleProps {
  prompt?: Prompt
  onGenerate?: (data: { text: string; model: Prompt["model"]; generationType: Prompt["generation_type"]; files: File[] }) => Promise<void>
  onEdit?: (promptId: string, data: { text: string; model: Prompt["model"]; generationType: Prompt["generation_type"]; existingMedia: { id: string; path: string; url: string; type: "image" | "video" }[]; newFiles: File[] }) => Promise<void>
  onDelete?: (promptId: string) => Promise<void>
}

export default function PromptBubble({ prompt, onGenerate, onEdit, onDelete }: PromptBubbleProps) {
  const isNew = !prompt
  const [mode, setMode] = useState<"view" | "edit" | "input" | "loading">(isNew ? "input" : "view")
  const [text, setText] = useState("")
  const [model, setModel] = useState<Prompt["model"]>("gen4_turbo")
  const [generationType, setGenerationType] = useState<Prompt["generation_type"]>("video")
  const [existingMedia, setExistingMedia] = useState<{ id: string; path: string; url: string; type: "image" | "video" }[]>([])
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
        await onEdit(prompt.id, { text, model, generationType, existingMedia, newFiles })
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
      <CardContent className="p-4">
        {mode === "loading" ? (
          <p className="text-center">Generating...</p>
        ) : mode === "view" && prompt ? (
          <>
            {prompt.media?.some((m) => m.category === "input") && (
              <div className="mt-2 space-y-2">
                <p className="font-semibold">Inputs:</p>
                {prompt.media.filter((m) => m.category === "input").map((m, index) => (
                  <div key={index}>
                    {m.type === "image" ? (
                      <img src={m.url} alt="Input" className="max-w-full" />
                    ) : (
                      <video src={m.url} controls className="max-w-full" />
                    )}
                  </div>
                ))}
              </div>
            )}
            <p className="font-semibold mt-2">{prompt.prompt_text}</p>
            <div className="mt-2 space-y-2">
              {prompt.media?.filter((m) => m.category === "output").map((m, index) => (
                <div key={index}>
                  {m.type === "image" ? (
                    <img src={m.url} alt="Generated" className="max-w-full" />
                  ) : (
                    <video src={m.url} controls className="max-w-full" />
                  )}
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <Button variant="outline" size="sm" onClick={handleEnterEdit}>
                Edit
              </Button>
              <Button variant="destructive" size="sm" onClick={() => onDelete?.(prompt.id)}>
                Delete
              </Button>
            </div>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Select value={model ?? ""} onValueChange={(v) => setModel(v as typeof model)}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gen2">Gen-2</SelectItem>
                <SelectItem value="gen3a">Gen-3 Alpha</SelectItem>
                <SelectItem value="gen4_aleph">Gen-4 Aleph</SelectItem>
                <SelectItem value="gen4_turbo">Gen-4 Turbo</SelectItem>
                <SelectItem value="gen4_image">Gen-4 Image</SelectItem>
                <SelectItem value="act_two">Act-Two</SelectItem>
                <SelectItem value="upscale_v1">Upscale V1</SelectItem>
              </SelectContent>
            </Select>
            <Select value={generationType ?? ""} onValueChange={(v) => setGenerationType(v as typeof generationType)} disabled={model === "upscale_v1"}>
              <SelectTrigger className="w-[100px]">
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
                  <div key={index} className="flex items-center space-x-2 mt-2">
                    {media.type === "image" ? (
                      <img src={media.url} alt="Input" className="max-w-[100px]" />
                    ) : (
                      <video src={media.url} controls className="max-w-[100px]" />
                    )}
                    <Button variant="destructive" size="sm" onClick={() => handleRemoveExisting(index)}>
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
                placeholder={isNew ? "Enter your prompt..." : "Edit your prompt..."}
              />
            )}
            <div className="flex gap-2">
              <Button type="submit">{isNew ? "Generate" : "Save and Re-generate"}</Button>
              {!isNew && <Button variant="outline" onClick={handleCancel}>Cancel</Button>}
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
