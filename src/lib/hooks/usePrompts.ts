"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { getMediaViewUrl } from "@/lib/media-view-url"
import { validateModelInputs, getModelById, mergeAdditionalParams } from "@runway-playground/shared"
import type { Prompt, MediaItem, GeneratePayload, EditPayload } from "@/lib/types"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function attachMediaDisplayUrls(media: Omit<MediaItem, "url">[]): MediaItem[] {
  return media.map((m) => ({
    ...m,
    url: getMediaViewUrl(m.path),
  }))
}

function scrollPromptCardIntoView(promptId: string) {
  if (typeof document === "undefined") return
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.getElementById(promptId)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      })
    })
  })
}

async function fetchSinglePrompt(promptId: string): Promise<Prompt> {
  const { data, error } = await supabase
    .from("prompts")
    .select("*, media(id, path, type, category, tag, position)")
    .eq("id", promptId)
    .order("id", { referencedTable: "media", ascending: true })
    .single()
  if (error) throw error
  const processedMedia = attachMediaDisplayUrls(data.media ?? [])
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
        .select("*, media(id, path, type, category, tag, position)")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: true })
        .order("id", { referencedTable: "media", ascending: true })

      if (error) {
        console.error(error)
        setPrompts([])
        return
      }

      const processed = data.map((prompt) => ({
        ...prompt,
        media: attachMediaDisplayUrls(prompt.media ?? []),
      }))
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
      const { text, model, generationType, filesWithTags, ratio, additionalParams } =
        payload

      if (!text && model !== "upscale_v1") throw new Error("Prompt is required")

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("You must be logged in to generate media")

      const apiKey = user.user_metadata.runway_api_key
      if (!apiKey) throw new Error("Runway API key not set in settings")

      const mergedForValidate = mergeAdditionalParams(model, additionalParams ?? null)
      const willHaveFileInputs = filesWithTags.length > 0
      const inputDef = getModelById(model)
      const usingTextOnly =
        !willHaveFileInputs && Boolean(inputDef.textOnlyEndpoint)

      validateModelInputs(
        model,
        generationType,
        text,
        filesWithTags.map((f) => ({
          type: f.file.type.startsWith("image/")
            ? ("image" as const)
            : ("video" as const),
          tag:
            inputDef.inputs.kind === "standard" && inputDef.inputs.tagsAllowed
              ? f.tag ?? undefined
              : inputDef.inputs.kind === "named"
                ? f.tag ?? undefined
                : undefined,
          position: f.position ?? undefined,
        })),
        ratio,
        mergedForValidate,
        { usingTextOnlyEndpoint: usingTextOnly },
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
      scrollPromptCardIntoView(promptId)

      try {
        // Upload input files
        const assets = await Promise.all(
          filesWithTags.map(async (item, index) => {
            const storageTag =
              inputDef.inputs.kind === "standard" && inputDef.inputs.tagsAllowed
                ? item.tag || `ref${index + 1}`
                : inputDef.inputs.kind === "named"
                  ? item.tag || null
                  : null

            // Unique path per slot: same `file.name` on two inputs (e.g. two "frame.png")
            // would otherwise share one storage key and the last upload would win.
            const filename = `${user.id}/inputs/${promptId}-${index}-${Date.now()}-${item.file.name}`
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
              tag: storageTag,
              position: item.position ?? null,
            })
            if (insertError) throw insertError

            const { data: signedData, error: signError } =
              await supabase.storage
                .from("media")
                .createSignedUrl(filename, 3600)
            if (signError) throw signError

            return {
              url: signedData.signedUrl,
              tag: storageTag ?? "",
              ...(item.position ? { position: item.position } : {}),
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
            additionalParams,
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
      const {
        text,
        model,
        generationType,
        existingMedia,
        newFilesWithTags,
        ratio,
        additionalParams,
      } = payload

      const mergedForValidate = mergeAdditionalParams(model, additionalParams ?? null)
      const willHaveFileInputs =
        existingMedia.length + newFilesWithTags.length > 0
      const inputDef = getModelById(model)
      const usingTextOnly =
        !willHaveFileInputs && Boolean(inputDef.textOnlyEndpoint)

      const tagForValidation = (raw: string | null | undefined) =>
        inputDef.inputs.kind === "standard" && inputDef.inputs.tagsAllowed
          ? raw ?? undefined
          : inputDef.inputs.kind === "named"
            ? raw ?? undefined
            : undefined

      validateModelInputs(
        model,
        generationType,
        text,
        [
          ...existingMedia.map((m) => ({
            type: m.type ?? ("image" as const),
            url: m.url,
            tag: tagForValidation(m.tag),
            position: m.position ?? undefined,
          })),
          ...newFilesWithTags.map((f) => ({
            type: f.file.type.startsWith("image/")
              ? ("image" as const)
              : ("video" as const),
            tag: tagForValidation(f.tag),
            position: f.position ?? undefined,
          })),
        ],
        ratio,
        mergedForValidate,
        { usingTextOnlyEndpoint: usingTextOnly },
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

      // Update tags and frame positions on kept media
      for (const [i, m] of existingMedia.entries()) {
        const nextTag =
          inputDef.inputs.kind === "standard" && inputDef.inputs.tagsAllowed
            ? m.tag || `ref${i + 1}`
            : inputDef.inputs.kind === "named"
              ? m.tag || null
              : null
        await supabase
          .from("media")
          .update({
            tag: nextTag,
            position: m.position ?? null,
          })
          .eq("id", m.id)
      }

      // Upload new files
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("User not found")

      const existingCount = existingMedia.length
      await Promise.all(
        newFilesWithTags.map(async ({ file, tag, position }, index) => {
          const storageTag =
            inputDef.inputs.kind === "standard" && inputDef.inputs.tagsAllowed
              ? tag || `ref${existingCount + index + 1}`
              : inputDef.inputs.kind === "named"
                ? tag || null
                : null

          const filename = `${user.id}/inputs/${promptId}-${existingCount + index}-${Date.now()}-${file.name}`
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
            tag: storageTag,
            position: position ?? null,
          })
          if (insertError) throw insertError
        }),
      )

      return fetchSinglePrompt(promptId)
    },
    [],
  )

  const regeneratePrompt = useCallback(
    async (
      promptId: string,
      freshPrompt?: Prompt,
      generateOptions?: { additionalParams?: Record<string, unknown> },
    ) => {
      const prompt = freshPrompt ?? prompts.find((p) => p.id === promptId)
      if (!prompt) throw new Error("Prompt not found")

      // Delete previous outputs from storage and DB
      const { data: oldOutputs } = await supabase
        .from("media")
        .select("id, path")
        .eq("prompt_id", promptId)
        .eq("category", "output")

      for (const out of oldOutputs ?? []) {
        await supabase.storage.from("media").remove([out.path])
        await supabase.from("media").delete().eq("id", out.id)
      }

      // Fetch input media from DB and re-sign URLs so they're fresh
      const { data: dbInputs } = await supabase
        .from("media")
        .select("id, path, type, tag, position")
        .eq("prompt_id", promptId)
        .eq("category", "input")
        .order("id", { ascending: true })

      const inputMedia = dbInputs ?? []

      const mergedForValidate = mergeAdditionalParams(
        prompt.model,
        generateOptions?.additionalParams ?? null,
      )
      const hasAssets = inputMedia.length > 0
      const usingTextOnly =
        !hasAssets && Boolean(getModelById(prompt.model).textOnlyEndpoint)

      validateModelInputs(
        prompt.model,
        prompt.generation_type,
        prompt.prompt_text,
        inputMedia.map((m) => ({
          type: (m.type ?? "image") as "image" | "video",
          tag: m.tag,
          position:
            m.position === "last"
              ? ("last" as const)
              : m.position === "first"
                ? ("first" as const)
                : ("first" as const),
        })),
        prompt.ratio,
        mergedForValidate,
        { usingTextOnlyEndpoint: usingTextOnly },
      )

      const assets = await Promise.all(
        inputMedia.map(async (m) => {
          const { data: signedData, error: signError } = await supabase.storage
            .from("media")
            .createSignedUrl(m.path, 3600)
          if (signError) throw signError
          const pos =
            m.position === "last"
              ? ("last" as const)
              : m.position === "first"
                ? ("first" as const)
                : undefined
          return {
            url: signedData.signedUrl,
            tag: m.tag ?? "",
            ...(pos ? { position: pos } : {}),
          }
        }),
      )

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          promptId,
          model: prompt.model,
          generationType: prompt.generation_type,
          assets,
          ratio: prompt.ratio,
          additionalParams: generateOptions?.additionalParams,
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
    const { error } = await supabase.from("prompts").delete().eq("id", promptId)
    if (error) throw error
    setPrompts((prev) => prev.filter((p) => p.id !== promptId))
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
