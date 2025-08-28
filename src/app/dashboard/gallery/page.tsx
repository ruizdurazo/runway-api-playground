"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import Link from "next/link"
import { Button } from "@/components/ui/Button"

import styles from "./page.module.scss"

interface MediaItem {
  id: string
  path: string
  url: string
  type: "image" | "video"
  created_at: string
  prompts?: { chat_id: string }
}

export default function GalleryPage() {
  const [media, setMedia] = useState<MediaItem[]>([])

  useEffect(() => {
    const fetchMedia = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        const { data, error } = await supabase
          .from("media")
          .select("*, prompts(chat_id)")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
        if (error) {
          console.error(error)
          setMedia([])
        } else {
          const processed = await Promise.all(
            data.map(async (item) => ({
              ...item,
              url: (
                await supabase.storage
                  .from("media")
                  .createSignedUrl(item.path, 3600)
              ).data?.signedUrl,
            })),
          )
          setMedia(processed)
        }
      }
    }
    fetchMedia()
  }, [])

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Media Gallery</h1>
      <div className={styles.galleryGrid}>
        {media.map((item) => (
          <div key={item.id} className={styles.mediaItem}>
            {item.type === "image" ? (
              <img
                src={item.url}
                alt="Generated image"
                className={styles.mediaImage}
              />
            ) : (
              <video src={item.url} controls className={styles.mediaVideo} />
            )}
            {item.prompts?.chat_id && (
              <div className={styles.viewChatButton}>
                <Link href={`/dashboard/chat/${item.prompts.chat_id}`}>
                  <Button size="sm">View Chat</Button>
                </Link>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
