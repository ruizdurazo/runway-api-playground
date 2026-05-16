"use client"

import { useEffect } from "react"
import { getMediaViewUrl } from "@/lib/media-view-url"
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
    let cancelled = false
    const channelRef: { current: RealtimeChannel | null } = { current: null }

    void (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user || cancelled) return

        const ch = supabase.channel(`chat-realtime-${chatId}`)
        if (cancelled) {
          await supabase.removeChannel(ch)
          return
        }

        channelRef.current = ch

        ch
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
              if (cancelled) return
              const newPrompt = await fetchSinglePrompt(payload.new.id)
              if (cancelled) return
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
              if (cancelled) return
              const promptId = payload.new.prompt_id
              if (!promptIdsRef.current.has(promptId)) return

              if (cancelled) return

              const newMedia: MediaItem = {
                id: payload.new.id,
                path: payload.new.path,
                type: payload.new.type,
                category: payload.new.category,
                tag: payload.new.tag,
                url: getMediaViewUrl(payload.new.path),
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
              if (cancelled) return
              const updated = await fetchSinglePrompt(payload.new.id)
              if (cancelled) return
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
              if (cancelled) return
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
              if (cancelled) return
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

        if (cancelled && channelRef.current === ch) {
          channelRef.current = null
          await supabase.removeChannel(ch)
        }
      } catch (err) {
        console.error("Realtime chat sync error:", err)
      }
    })()

    return () => {
      cancelled = true
      const ch = channelRef.current
      channelRef.current = null
      if (ch) {
        void supabase.removeChannel(ch)
      }
    }
  }, [chatId, promptIdsRef, fetchSinglePrompt, setPrompts])
}
