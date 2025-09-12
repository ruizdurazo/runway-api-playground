"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import Link from "next/link"
import { Button } from "@/components/ui/Button"
import type { RealtimeChannel } from "@supabase/supabase-js"

import styles from "./page.module.scss"

interface MediaItem {
  id: string
  path: string
  url: string
  type: "image" | "video"
  created_at: string
  prompt?: { chat_id: string }
}

export default function GalleryClient() {
  const [media, setMedia] = useState<MediaItem[]>([])
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
          "id, path, type, category, tag, created_at, prompt:prompt_id(chat_id)",
        )
        .eq("user_id", user.id)
        .eq("category", "output")
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Error fetching media:", error)
        return
      }

      // Get signed URLs for each media item
      const mediaWithUrls = await Promise.all(
        data.map(async (item) => {
          const { data: signedData } = await supabase.storage
            .from("media")
            .createSignedUrl(item.path, 3600)

          return {
            ...item,
            prompt:
              item.prompt && "chat_id" in item.prompt
                ? { chat_id: item.prompt.chat_id as string }
                : undefined,
            url: signedData?.signedUrl || "",
          }
        }),
      )

      setMedia(mediaWithUrls)
    } catch (error) {
      console.error("Error fetching media:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchMedia()
  }, [])

  useEffect(() => {
    let channel: RealtimeChannel | undefined
    ;(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return
      channel = supabase.channel("media-realtime")
      channel
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "media",
            filter: `user_id=eq.${user.id}`,
          },
          async (payload) => {
            if (payload.new.category !== "output") return
            const { data: chatData } = await supabase
              .from("prompts")
              .select("chat_id")
              .eq("id", payload.new.prompt_id)
              .single()
            const { data: signedData } = await supabase.storage
              .from("media")
              .createSignedUrl(payload.new.path, 3600)
            const newItem: MediaItem = {
              id: payload.new.id,
              path: payload.new.path,
              url: signedData?.signedUrl || "",
              type: payload.new.type,
              created_at: payload.new.created_at,
              prompt: chatData ? { chat_id: chatData.chat_id } : undefined,
            }
            setMedia((prev) => [newItem, ...prev])
          },
        )
        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table: "media",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            const mediaId = payload.old?.id
            if (mediaId) {
              setMedia((prev) => {
                const filtered = prev.filter((m) => m.id !== mediaId)
                return filtered
              })
            } else {
              console.log("DELETE payload.old missing id, refetching gallery")
              fetchMedia()
            }
          },
        )
        .subscribe()
    })()
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
                <img src={item.url} alt="" className={styles.mediaImage} />
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
