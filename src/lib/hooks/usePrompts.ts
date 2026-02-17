"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { validateModelInputs } from "@/lib/models/validation"
import type { Prompt, MediaItem, GeneratePayload, EditPayload } from "@/lib/types"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function signMediaUrls(
  media: Omit<MediaItem, "url">[],
): Promise<MediaItem[]> {
  return Promise.all(
    media.map(async (m) => {
      const { data } = await supabase.storage
        .from("media")
        .createSignedUrl(m.path, 3600)
      return { ...m, url: data?.signedUrl ?? "" }
    }),
  )
}

async function fetchSinglePrompt(promptId: string): Promise<Prompt> {
  const { data, error } = await supabase
    .from("prompts")
    .select("*, media(id, path, type, category, tag)")
    .eq("id", promptId)
    .single()
  if (error) throw error
  const processedMedia = await signMediaUrls(data.media ?? [])
  return { ...data, media: processedMedia }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePrompts(chatId: string) {
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const promptIdsRef = useRef(new Set<string>())

  // Keep ref in sync
  useEffect(() => {
    promptIdsRef.current = new Set(prompts.map((p) => p.id))
  }, [prompts])

  // Initial fetch
  useEffect(() => {
    const fetchAll = async () => {
      const { data, error } = await supabase
        .from("prompts")
        .select("*, media(id, path, type, category, tag)")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: true })

      if (error) {
        console.error(error)
        setPrompts([])
        return
      }

      const processed = await Promise.all(
        data.map(async (prompt) => ({
          ...prompt,
          media: await signMediaUrls(prompt.media ?? []),
        })),
      )
      setPrompts(processed)
    }
    fetchAll()
  }, [chatId])

  // Scroll to hash after prompts load
  useEffect(() => {
    if (
      prompts.length > 0 &&
      typeof window !== "undefined" &&
      window.location.hash
    ) {
      const hash = window.location.hash.slice(1)
      const el = document.getElementById(hash)
      el?.scrollIntoView({ behavior: "smooth", block: "center" })
    }
  }, [prompts])

  // ---- CRUD ----------------------------------------------------------------

  const createPrompt = useCallback(
    async (payload: GeneratePayload) => {
      const { text, model, generationType, filesWithTags, ratio } = payload

      if (!text && model !== "upscale_v1") throw new Error("Prompt is required")

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("You must be logged in to generate media")

      const apiKey = user.user_metadata.runway_api_key
      if (!apiKey) throw new Error("Runway API key not set in settings")

      validateModelInputs(
        model,
        generationType,
        text,
        filesWithTags.map((f) => ({
          type: f.file.type.startsWith("image/")
            ? ("image" as const)
            : ("video" as const),
          tag: f.tag,
          position: f.position ?? undefined,
        })),
        ratio,
      )

      // Insert prompt row
      const { data: promptData, error: promptError } = await supabase
        .from("prompts")
        .insert({
          chat_id: chatId,
          prompt_text: text,
          model,
          generation_type: generationType,
          ratio,
        })
        .select()
      if (promptError) throw promptError
      const promptId = promptData[0].id

      // Optimistic UI
      setPrompts((prev) => [
        ...prev,
        {
          id: promptId,
          prompt_text: text,
          created_at: new Date().toISOString(),
          model,
          generation_type: generationType,
          media: [],
          ratio,
        },
      ])

      try {
        // Upload input files
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

            const { data: signedData, error: signError } =
              await supabase.storage
                .from("media")
                .createSignedUrl(filename, 3600)
            if (signError) throw signError

            return {
              url: signedData.signedUrl,
              tag: item.tag || `ref${index + 1}`,
            }
          }),
        )

        // Call generate API
        const response = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            promptId,
            model,
            generationType,
            assets,
            ratio,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.message)
        }
      } catch (err) {
        // Rollback on failure
        await supabase.from("prompts").delete().eq("id", promptId)
        throw err
      }

      // Refresh with final data
      const final = await fetchSinglePrompt(promptId)
      setPrompts((prev) =>
        prev.map((p) => (p.id === promptId ? final : p)),
      )
    },
    [chatId],
  )

  const updatePrompt = useCallback(
    async (promptId: string, payload: EditPayload): Promise<Prompt> => {
      const { text, model, generationType, existingMedia, newFilesWithTags, ratio } =
        payload

      validateModelInputs(
        model,
        generationType,
        text,
        existingMedia.map((m) => ({
          type: m.type ?? ("image" as const),
          url: m.url,
          tag: m.tag,
          position: m.position ?? undefined,
        })),
        ratio,
      )

      // Delete old outputs
      const { data: oldOutputs } = await supabase
        .from("media")
        .select("path")
        .eq("prompt_id", promptId)
        .eq("category", "output")
      for (const out of oldOutputs ?? []) {
        await supabase.storage.from("media").remove([out.path])
      }
      await supabase
        .from("media")
        .delete()
        .eq("prompt_id", promptId)
        .eq("category", "output")

      // Update prompt row
      const { data: updatedPrompt, error: updateError } = await supabase
        .from("prompts")
        .update({ prompt_text: text, model, generation_type: generationType, ratio })
        .eq("id", promptId)
        .select()
        .single()
      if (updateError || !updatedPrompt)
        throw new Error("Unable to update prompt")

      // Remove deleted inputs
      const { data: currentInputs } = await supabase
        .from("media")
        .select("id, path")
        .eq("prompt_id", promptId)
        .eq("category", "input")

      const keptIds = existingMedia.map((m) => m.id)
      const toDelete =
        currentInputs?.filter((ci) => !keptIds.includes(ci.id)) ?? []

      for (const del of toDelete) {
        await supabase.storage.from("media").remove([del.path])
        await supabase.from("media").delete().eq("id", del.id)
      }

      // Update tags on kept media
      for (const m of existingMedia) {
        await supabase
          .from("media")
          .update({ tag: m.tag || null })
          .eq("id", m.id)
      }

      // Upload new files
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

      return fetchSinglePrompt(promptId)
    },
    [],
  )

  const regeneratePrompt = useCallback(
    async (promptId: string, freshPrompt?: Prompt) => {
      const prompt = freshPrompt ?? prompts.find((p) => p.id === promptId)
      if (!prompt) throw new Error("Prompt not found")

      const inputMedia =
        prompt.media?.filter((m) => m.category === "input") ?? []

      validateModelInputs(
        prompt.model,
        prompt.generation_type,
        prompt.prompt_text,
        inputMedia.map((m) => ({
          type: m.type ?? ("image" as const),
          url: m.url,
          tag: m.tag,
          position: "first" as const,
        })),
        prompt.ratio,
      )

      const assets = inputMedia.map((m, i) => ({
        url: m.url,
        tag: m.tag || `ref${i + 1}`,
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

      const updated = await fetchSinglePrompt(promptId)
      setPrompts((prev) =>
        prev.map((p) => (p.id === promptId ? updated : p)),
      )
    },
    [prompts],
  )

  const deletePrompt = useCallback(async (promptId: string) => {
    const { data: mediaToDelete } = await supabase
      .from("media")
      .select("path")
      .eq("prompt_id", promptId)
    for (const m of mediaToDelete ?? []) {
      await supabase.storage.from("media").remove([m.path])
    }
    await supabase.from("media").delete().eq("prompt_id", promptId)
    await supabase.from("prompts").delete().eq("id", promptId)
  }, [])

  return {
    prompts,
    setPrompts,
    promptIdsRef,
    fetchSinglePrompt,
    createPrompt,
    updatePrompt,
    regeneratePrompt,
    deletePrompt,
  }
}
