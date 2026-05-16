"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import Link from "next/link"
// import Image from "next/image"
import { Button } from "@/components/ui/Button"
import type { RealtimeChannel } from "@supabase/supabase-js"

import styles from "./page.module.scss"
import { getMediaViewUrl } from "@/lib/media-view-url"

interface GalleryMediaItem {
  id: string
  path: string
  url: string
  type: "image" | "video"
  created_at: string
  prompt?: { chat_id: string; ratio?: string }
}

export default function GalleryClient() {
  const [media, setMedia] = useState<GalleryMediaItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchMedia = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from("media")
        .select(
          "id, path, type, category, tag, created_at, prompt:prompt_id!inner(chat_id, ratio)",
        )
        .eq("user_id", user.id)
        .eq("category", "output")
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Error fetching media:", error)
        return
      }

      const mediaWithUrls: GalleryMediaItem[] = data.map((item) => {
        const promptData = item.prompt as unknown as {
          chat_id: string
          ratio: string
        } | null

        return {
          id: item.id,
          path: item.path,
          type: item.type as "image" | "video",
          created_at: item.created_at,
          prompt: promptData
            ? { chat_id: promptData.chat_id, ratio: promptData.ratio }
            : undefined,
          url: getMediaViewUrl(item.path),
        }
      })

      setMedia(mediaWithUrls)
    } catch (err) {
      console.error("Error fetching media:", err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchMedia()
  }, [])

  useEffect(() => {
    let cancelled = false
    const channelRef: { current: RealtimeChannel | null } = { current: null }

    void (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user || cancelled) return

        const ch = supabase.channel("media-realtime")
        if (cancelled) {
          await supabase.removeChannel(ch)
          return
        }

        channelRef.current = ch

        ch.on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "media",
            filter: `user_id=eq.${user.id}`,
          },
          async (payload) => {
            if (cancelled) return
            if (payload.new.category !== "output") return
            const { data: chatData } = await supabase
              .from("prompts")
              .select("chat_id, ratio")
              .eq("id", payload.new.prompt_id)
              .single()
            if (cancelled) return
            const newItem: GalleryMediaItem = {
              id: payload.new.id,
              path: payload.new.path,
              url: getMediaViewUrl(payload.new.path),
              type: payload.new.type as "image" | "video",
              created_at: payload.new.created_at,
              prompt: chatData
                ? { chat_id: chatData.chat_id, ratio: chatData.ratio }
                : undefined,
            }
            setMedia((prev) => [newItem, ...prev])
          },
        ).on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table: "media",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            if (cancelled) return
            const mediaId = payload.old?.id
            if (mediaId) {
              setMedia((prev) => prev.filter((m) => m.id !== mediaId))
            } else {
              void fetchMedia()
            }
          },
        ).subscribe()

        if (cancelled && channelRef.current === ch) {
          channelRef.current = null
          await supabase.removeChannel(ch)
        }
      } catch (err) {
        console.error("Realtime gallery subscription error:", err)
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
  }, [])

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Media Gallery</h1>
      {isLoading ? (
        <div className={styles.loading}>Loading your media...</div>
      ) : media.length === 0 ? (
        <div className={styles.empty}>
          No media found. Generate some content to see it here!
        </div>
      ) : (
        <div className={styles.galleryGrid}>
          {media.map((item) => (
            <div key={item.id} className={styles.mediaItem}>
              {item.type === "image" ? (
                // eslint-disable-next-line
                <img src={item.url} alt="" className={styles.mediaImage} />
                // <Image src={item.url} alt="" className={styles.mediaImage} />
              ) : (
                <video
                  src={item.url}
                  className={styles.mediaVideo}
                  muted
                  loop
                  autoPlay
                  playsInline
                />
              )}
              {item.prompt?.chat_id && (
                <div className={styles.viewChatButton}>
                  <Link
                    href={`/dashboard/chat/${item.prompt.chat_id}#${item.id}`}
                  >
                    <Button size="sm">View in Chat</Button>
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
