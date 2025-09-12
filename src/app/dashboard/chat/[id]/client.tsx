"use client"

import { useEffect, useState, useRef } from "react"
import { useParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import PromptBubble from "@/components/PromptBubble"
import type { RealtimeChannel } from "@supabase/supabase-js"

import styles from "./page.module.scss"

export interface Prompt {
  id: string
  prompt_text: string
  created_at: string
  model:
    | "gen4_turbo"
    | "gen4_aleph"
    | "gen4_image"
    | "gen4_image_turbo"
    | "act_two"
    | "upscale_v1"
    // | "veo3"
    // | "gemini_2.5_flash"
  generation_type?: "image" | "video"
  ratio?: string
  media?: {
    id: string
    path: string
    url: string
    type: "image" | "video"
    category: "input" | "output"
    tag: string | null
  }[]
}

// Valid model outputs (generation_type)
// gen4_aleph: video
// gen4_turbo: video
// gen4_image: image
// gen4_image_turbo: image
// act_two: video
// upscale_v1: video

// Valid model inputs (media.type)
// gen4_aleph: video + image/text
// gen4_turbo: image + text
// gen4_image: image/text
// gen4_image_turbo: image + text
// act_two: video + image/video (special case with `character` field needed, no `promptText`)
// upscale_v1: video

export default function ChatClient() {
  const { id } = useParams()
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const promptIdsRef = useRef(new Set())

  useEffect(() => {
    promptIdsRef.current = new Set(prompts.map((p) => p.id))
  }, [prompts])

  useEffect(() => {
    const fetchPrompts = async () => {
      const { data, error } = await supabase
        .from("prompts")
        .select("*, media(id, path, type, category, tag)")
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
                  id: string
                  path: string
                  type: "image" | "video"
                  category: "input" | "output"
                  tag: string | null
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

  useEffect(() => {
    if (prompts.length > 0 && typeof window !== 'undefined' && window.location.hash) {
      const hash = window.location.hash.slice(1)
      const element = document.getElementById(hash)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }, [prompts])

  useEffect(() => {
    let channel: RealtimeChannel | undefined
    ;(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return
      channel = supabase.channel(`chat-realtime-${id}`)
      channel
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "prompts",
            filter: `chat_id=eq.${id}`,
          },
          async (payload) => {
            const newPrompt = await fetchSinglePrompt(payload.new.id)
            if (promptIdsRef.current.has(newPrompt.id)) {
              setPrompts((prev) =>
                prev.map((p) => (p.id === newPrompt.id ? newPrompt : p)),
              )
            } else {
              setPrompts((prev) => [...prev, newPrompt])
            }
          },
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "media",
          },
          async (payload) => {
            const promptId = payload.new.prompt_id
            if (promptIdsRef.current.has(promptId)) {
              const { data } = await supabase.storage
                .from("media")
                .createSignedUrl(payload.new.path, 3600)
              const url = data?.signedUrl || ""
              const newMedia = {
                id: payload.new.id,
                path: payload.new.path,
                type: payload.new.type,
                category: payload.new.category,
                tag: payload.new.tag,
                url,
              }
              setPrompts((prev) =>
                prev.map((p) =>
                  p.id === promptId &&
                  !p.media?.some((m) => m.id === newMedia.id)
                    ? { ...p, media: [...(p.media ?? []), newMedia] }
                    : p,
                ),
              )
            }
          },
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "prompts",
            filter: `chat_id=eq.${id}`,
          },
          async (payload) => {
            const updatedPrompt = await fetchSinglePrompt(payload.new.id)
            setPrompts((prev) =>
              prev.map((p) => (p.id === payload.new.id ? updatedPrompt : p)),
            )
          },
        )
        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table: "prompts",
          },
          (payload) => {
            console.log("DELETE PROMPT", payload)
            console.log("DELETE PROMPT old:", payload.old)
            setPrompts((prev) => {
              if (prev.some((p) => p.id === payload.old.id)) {
                const newPrompts = prev.filter((p) => p.id !== payload.old.id)
                console.log(
                  "Filtered prompts from",
                  prev.length,
                  "to",
                  newPrompts.length,
                )
                return newPrompts
              }
              return prev // Not in this chat, ignore
            })
          },
        )
        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table: "media",
          },
          (payload) => {
            const promptId = payload.old.prompt_id
            const mediaId = payload.old.id
            if (promptIdsRef.current.has(promptId)) {
              setPrompts((prev) =>
                prev.map((p) =>
                  p.id === promptId
                    ? {
                        ...p,
                        media: (p.media ?? []).filter((m) => m.id !== mediaId),
                      }
                    : p,
                ),
              )
            }
          },
        )
        .subscribe((status, err) => {
          console.log("Subscription status:", status)
          if (err) console.log("Subscription error:", err)
        })
    })()
  }, [id])

  const fetchSinglePrompt = async (promptId: string): Promise<Prompt> => {
    const { data, error } = await supabase
      .from("prompts")
      .select("*, media(id, path, type, category, tag)")
      .eq("id", promptId)
      .single()
    if (error) throw error
    const processedMedia = await Promise.all(
      (data.media || []).map(
        async (m: {
          id: string
          path: string
          type: "image" | "video"
          category: "input" | "output"
          tag: string | null
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
    filesWithTags,
    ratio,
  }: {
    text: string
    model: Prompt["model"]
    generationType: Prompt["generation_type"]
    filesWithTags: { file: File; tag: string }[]
    ratio: string
  }) => {
    if (!text && model !== "upscale_v1") throw new Error("Prompt is required")
    if (model !== "upscale_v1" && filesWithTags.length > 3) {
      throw new Error("Maximum of 3 reference images allowed")
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error("You must be logged in to generate media")

    const apiKey = user.user_metadata.runway_api_key
    if (!apiKey) throw new Error("Runway API key not set in settings")

    if (model === "upscale_v1") {
      if (
        filesWithTags.length !== 1 ||
        !filesWithTags[0].file.type.startsWith("video/")
      ) {
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
        ratio,
      })
      .select()
    if (promptError) throw promptError

    const promptId = promptData[0].id

    setPrompts((prev) => [
      ...prev,
      {
        id: promptId,
        prompt_text: text,
        created_at: new Date().toISOString(),
        model,
        generation_type: generationType,
        media: [],
      },
    ])

    try {
      const assets = await Promise.all(
        filesWithTags.map(async (item, index) => {
          const filename = `${user.id}/inputs/${promptId}-${item.file.name}`
          const { error: uploadError } = await supabase.storage
            .from("media")
            .upload(filename, item.file)
          if (uploadError) throw uploadError

          const type = item.file.type.startsWith("image/") ? "image" : "video"
          const { error: insertError } = await supabase.from("media").insert({
            prompt_id: promptId,
            user_id: user.id,
            path: filename,
            type,
            category: "input",
            tag: item.tag || null,
          })
          if (insertError) throw insertError

          const { data: signedData, error: signError } = await supabase.storage
            .from("media")
            .createSignedUrl(filename, 3600)
          if (signError) throw signError

          return {
            url: signedData.signedUrl,
            tag: item.tag || `ref${index + 1}`,
          }
        }),
      )

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promptId, model, generationType, assets, ratio }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message)
      }
    } catch (err) {
      await supabase.from("prompts").delete().eq("id", promptId)
      throw err
    }

    const finalPrompt = await fetchSinglePrompt(promptId)
    setPrompts((prev) => prev.map((p) => (p.id === promptId ? finalPrompt : p)))
  }

  const onEdit = async (
    promptId: string,
    {
      text,
      model,
      generationType,
      existingMedia,
      newFilesWithTags,
      ratio,
    }: {
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
  ) => {
    const totalInputs = existingMedia.length + newFilesWithTags.length
    if (model !== "upscale_v1" && totalInputs > 3) {
      throw new Error("Maximum of 3 reference images allowed")
    }

    // Delete old outputs first
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

    const { data: updatedPrompt, error: updateError } = await supabase
      .from("prompts")
      .update({ prompt_text: text, model, generation_type: generationType, ratio })
      .eq("id", promptId)
      .select()
      .single()
    if (updateError || !updatedPrompt) throw new Error("Prompt not found or unable to update")

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

    // Update tags for existing media
    for (const m of existingMedia) {
      await supabase
        .from("media")
        .update({ tag: m.tag || null })
        .eq("id", m.id)
    }

    // Upload and insert new files
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error("User not found")

    await Promise.all(
      newFilesWithTags.map(async ({ file, tag }) => {
        const filename = `${user.id}/inputs/${promptId}-${Date.now()}-${file.name}`
        const { error: uploadError } = await supabase.storage
          .from("media")
          .upload(filename, file)
        if (uploadError) throw uploadError

        const type = file.type.startsWith("image/") ? "image" : "video"
        const { error: insertError } = await supabase.from("media").insert({
          prompt_id: promptId,
          user_id: user.id,
          path: filename,
          type,
          category: "input",
          tag: tag || null,
        })
        if (insertError) throw insertError
      }),
    )

    // After all media operations, fetch current input media to return accurate prompt
    const { data: currentMedia, error: mediaError } = await supabase
      .from("media")
      .select("id, path, type, category, tag")
      .eq("prompt_id", promptId)
      .eq("category", "input")
    if (mediaError) throw mediaError

    return { ...updatedPrompt, media: currentMedia }
  }

  const onRegenerate = async (promptId: string, freshPrompt?: Prompt) => {
    const prompt = freshPrompt ?? prompts.find((p) => p.id === promptId)
    if (!prompt) throw new Error("Prompt not found")

    const inputMedia = prompt.media?.filter((m) => m.category === "input") || []
    const assets = inputMedia.map((m, index) => ({
      url: m.url,
      tag: m.tag || `ref${index + 1}`,
    }))

    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        promptId,
        model: prompt.model,
        generationType: prompt.generation_type,
        assets,
        ratio: prompt.ratio,
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
  }

  return (
    <div className={styles.chatContainer}>
      {/* Prompt List */}
      <div className={styles.promptList}>
        {prompts.map((prompt) => (
          <PromptBubble
            id={prompt.id}
            key={prompt.id}
            prompt={prompt}
            onEdit={onEdit}
            onDelete={onDelete}
            onRegenerate={onRegenerate}
          />
        ))}
      </div>

      {/* New Prompt Section */}
      <div className={styles.newPromptSection}>
        <PromptBubble key="new" onGenerate={onGenerate} />
      </div>
    </div>
  )
}
