"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import PromptBubble from "@/components/PromptBubble"

import styles from "./page.module.scss"

export interface Prompt {
  id: string
  prompt_text: string
  created_at: string
  model?:
    | "gen4_aleph"
    | "gen4_turbo"
    | "gen4_image"
    | "gen4_image_turbo"
    | "act_two"
    | "upscale_v1"
  generation_type?: "image" | "video"
  media?: {
    id: string
    path: string
    url: string
    type: "image" | "video"
    category: "input" | "output"
  }[]
}

export default function ChatClient() {
  const { id } = useParams()
  const [prompts, setPrompts] = useState<Prompt[]>([])

  useEffect(() => {
    const fetchPrompts = async () => {
      const { data, error } = await supabase
        .from("prompts")
        .select("*, media(id, path, type, category)")
        .eq("chat_id", id)
        .order("created_at", { ascending: true })
      if (error) {
        console.error(error)
        setPrompts([])
      } else {
        const processed = await Promise.all(
          data.map(async (prompt) => ({
            ...prompt,
            media: await Promise.all(
              (prompt.media || []).map(
                async (m: {
                  path: string
                  type: "image" | "video"
                  category: "input" | "output"
                }) => ({
                  ...m,
                  url:
                    (
                      await supabase.storage
                        .from("media")
                        .createSignedUrl(m.path, 3600)
                    ).data?.signedUrl || "",
                }),
              ),
            ),
          })),
        )
        setPrompts(processed)
      }
    }
    fetchPrompts()
  }, [id])

  const fetchSinglePrompt = async (promptId: string): Promise<Prompt> => {
    const { data, error } = await supabase
      .from("prompts")
      .select("*, media(id, path, type, category)")
      .eq("id", promptId)
      .single()
    if (error) throw error
    const processedMedia = await Promise.all(
      (data.media || []).map(
        async (m: {
          path: string
          type: "image" | "video"
          category: "input" | "output"
        }) => ({
          ...m,
          url:
            (await supabase.storage.from("media").createSignedUrl(m.path, 3600))
              .data?.signedUrl || "",
        }),
      ),
    )
    return { ...data, media: processedMedia }
  }

  const onGenerate = async ({
    text,
    model,
    generationType,
    files,
  }: {
    text: string
    model: Prompt["model"]
    generationType: Prompt["generation_type"]
    files: File[]
  }) => {
    if (!text && model !== "upscale_v1") throw new Error("Prompt is required")

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error("You must be logged in to generate media")

    const apiKey = user.user_metadata.runway_api_key
    if (!apiKey) throw new Error("Runway API key not set in settings")

    if (model === "upscale_v1") {
      if (files.length !== 1 || !files[0].type.startsWith("video/")) {
        throw new Error("Upscale requires exactly one video file.")
      }
      if (generationType !== "video") {
        throw new Error("Upscale can only generate videos.")
      }
    }

    const { data: promptData, error: promptError } = await supabase
      .from("prompts")
      .insert({
        chat_id: id,
        prompt_text: text,
        model,
        generation_type: generationType,
      })
      .select()
    if (promptError) throw promptError

    const promptId = promptData[0].id

    const assetUrls: string[] = []
    for (const file of files) {
      const filename = `${user.id}/inputs/${promptId}-${file.name}`
      const { error: uploadError } = await supabase.storage
        .from("media")
        .upload(filename, file)
      if (uploadError) throw uploadError

      const { data: signedData, error: signError } = await supabase.storage
        .from("media")
        .createSignedUrl(filename, 3600)
      if (signError) throw signError
      assetUrls.push(signedData.signedUrl)
    }

    for (const file of files) {
      const filename = `${user.id}/inputs/${promptId}-${file.name}`
      const type = file.type.startsWith("image/") ? "image" : "video"
      const { error: insertError } = await supabase.from("media").insert({
        prompt_id: promptId,
        user_id: user.id,
        path: filename,
        type,
        category: "input",
      })
      if (insertError) throw insertError
    }

    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ promptId, model, generationType, assetUrls }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.message)
    }

    const newPrompt = await fetchSinglePrompt(promptId)
    setPrompts((prev) => [...prev, newPrompt])
  }

  const onEdit = async (
    promptId: string,
    {
      text,
      model,
      generationType,
      existingMedia,
      newFiles,
    }: {
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
  ) => {
    await supabase
      .from("prompts")
      .update({ prompt_text: text, model, generation_type: generationType })
      .eq("id", promptId)

    const { data: currentInputs } = await supabase
      .from("media")
      .select("id, path")
      .eq("prompt_id", promptId)
      .eq("category", "input")

    const keptIds = existingMedia.map((m) => m.id)
    const toDelete =
      currentInputs?.filter((ci) => !keptIds.includes(ci.id)) || []

    for (const del of toDelete) {
      await supabase.storage.from("media").remove([del.path])
      await supabase.from("media").delete().eq("id", del.id)
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const newAssetUrls: string[] = []
    for (const file of newFiles) {
      const filename = `${user?.id}/inputs/${promptId}-${file.name}`
      const { error } = await supabase.storage
        .from("media")
        .upload(filename, file)
      if (error) throw error
      const type = file.type.startsWith("image/") ? "image" : "video"
      const { error: insertErr } = await supabase.from("media").insert({
        prompt_id: promptId,
        user_id: user?.id,
        path: filename,
        type,
        category: "input",
      })
      if (insertErr) throw insertErr
      const { data: signed } = await supabase.storage
        .from("media")
        .createSignedUrl(filename, 3600)
      if (signed?.signedUrl) newAssetUrls.push(signed.signedUrl)
    }

    const keptAssetUrls = await Promise.all(
      existingMedia.map(async (m) => {
        const { data } = await supabase.storage
          .from("media")
          .createSignedUrl(m.path, 3600)
        return data?.signedUrl || ""
      }),
    )

    const allAssetUrls = [...keptAssetUrls.filter(Boolean), ...newAssetUrls]

    const { data: oldOutputs } = await supabase
      .from("media")
      .select("path")
      .eq("prompt_id", promptId)
      .eq("category", "output")
    for (const out of oldOutputs || []) {
      await supabase.storage.from("media").remove([out.path])
    }
    await supabase
      .from("media")
      .delete()
      .eq("prompt_id", promptId)
      .eq("category", "output")

    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        promptId,
        model,
        generationType,
        assetUrls: allAssetUrls,
      }),
    })
    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.message)
    }

    const updatedPrompt = await fetchSinglePrompt(promptId)
    setPrompts((prev) =>
      prev.map((p) => (p.id === promptId ? updatedPrompt : p)),
    )
  }

  const onDelete = async (promptId: string) => {
    const { data: mediaToDelete } = await supabase
      .from("media")
      .select("path")
      .eq("prompt_id", promptId)
    for (const m of mediaToDelete || []) {
      await supabase.storage.from("media").remove([m.path])
    }
    await supabase.from("media").delete().eq("prompt_id", promptId)
    await supabase.from("prompts").delete().eq("id", promptId)
    setPrompts((prev) => prev.filter((p) => p.id !== promptId))
  }

  return (
    <div className={styles.chatContainer}>
      <div className={styles.promptList}>
        {prompts.map((prompt) => (
          <PromptBubble
            key={prompt.id}
            prompt={prompt}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>
      <div className={styles.newPromptSection}>
        <PromptBubble key="new" onGenerate={onGenerate} />
      </div>
    </div>
  )
}
