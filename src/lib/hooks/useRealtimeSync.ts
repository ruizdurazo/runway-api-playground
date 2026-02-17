"use client"

import { useEffect } from "react"
import { supabase } from "@/lib/supabase"
import type { RealtimeChannel } from "@supabase/supabase-js"
import type { Prompt, MediaItem } from "@/lib/types"

interface UseRealtimeSyncOptions {
  chatId: string
  /** Ref containing current prompt IDs (for dedup). */
  promptIdsRef: React.MutableRefObject<Set<string>>
  /** Fetch a single prompt with signed media URLs. */
  fetchSinglePrompt: (promptId: string) => Promise<Prompt>
  setPrompts: React.Dispatch<React.SetStateAction<Prompt[]>>
}

export function useRealtimeSync({
  chatId,
  promptIdsRef,
  fetchSinglePrompt,
  setPrompts,
}: UseRealtimeSyncOptions) {
  useEffect(() => {
    let channel: RealtimeChannel | undefined

    ;(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      channel = supabase.channel(`chat-realtime-${chatId}`)

      channel
        // Prompt INSERT
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "prompts",
            filter: `chat_id=eq.${chatId}`,
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
        // Media INSERT
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "media",
          },
          async (payload) => {
            const promptId = payload.new.prompt_id
            if (!promptIdsRef.current.has(promptId)) return

            const { data } = await supabase.storage
              .from("media")
              .createSignedUrl(payload.new.path, 3600)

            const newMedia: MediaItem = {
              id: payload.new.id,
              path: payload.new.path,
              type: payload.new.type,
              category: payload.new.category,
              tag: payload.new.tag,
              url: data?.signedUrl ?? "",
            }

            setPrompts((prev) =>
              prev.map((p) =>
                p.id === promptId &&
                !p.media?.some((m) => m.id === newMedia.id)
                  ? { ...p, media: [...(p.media ?? []), newMedia] }
                  : p,
              ),
            )
          },
        )
        // Prompt UPDATE
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "prompts",
            filter: `chat_id=eq.${chatId}`,
          },
          async (payload) => {
            const updated = await fetchSinglePrompt(payload.new.id)
            setPrompts((prev) =>
              prev.map((p) => (p.id === payload.new.id ? updated : p)),
            )
          },
        )
        // Prompt DELETE
        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table: "prompts",
          },
          (payload) => {
            setPrompts((prev) => prev.filter((p) => p.id !== payload.old.id))
          },
        )
        // Media DELETE
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
            if (!promptIdsRef.current.has(promptId)) return

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
          },
        )
        .subscribe()
    })()

    return () => {
      channel?.unsubscribe()
    }
  }, [chatId, promptIdsRef, fetchSinglePrompt, setPrompts])
}
