"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import Link from "next/link"
import { Button } from "@/components/ui/button"

interface MediaItem {
  id: string
  path: string
  url: string
  type: 'image' | 'video'
  created_at: string
  prompts?: { chat_id: string }
}

export default function GalleryPage() {
  const [media, setMedia] = useState<MediaItem[]>([])

  useEffect(() => {
    const fetchMedia = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data, error } = await supabase
          .from('media')
          .select('*, prompts(chat_id)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
        if (error) {
          console.error(error)
          setMedia([])
        } else {
          const processed = await Promise.all(data.map(async (item) => ({
            ...item,
            url: (await supabase.storage.from('media').createSignedUrl(item.path, 3600)).data?.signedUrl
          })))
          setMedia(processed)
        }
      }
    }
    fetchMedia()
  }, [])

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Media Gallery</h1>
      <div className="grid grid-cols-3 gap-4">
        {media.map((item) => (
          <div key={item.id} className="aspect-video bg-muted rounded-lg overflow-hidden relative group">
            {item.type === 'image' ? (
              <img src={item.url} alt="Generated image" className="object-cover w-full h-full" />
            ) : (
              <video src={item.url} controls className="w-full h-full" />
            )}
            {item.prompts?.chat_id && (
              <div className="absolute top-2 right-2 hidden group-hover:block">
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
