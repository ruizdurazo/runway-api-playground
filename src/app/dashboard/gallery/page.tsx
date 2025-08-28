"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

interface MediaItem {
  id: string
  path: string
  url: string
  type: 'image' | 'video'
  created_at: string
}

export default function GalleryPage() {
  const [media, setMedia] = useState<MediaItem[]>([])

  useEffect(() => {
    const fetchMedia = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data, error } = await supabase
          .from('media')
          .select('*')
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
    <div>
      <h1 className="text-2xl font-bold mb-4">My Media Gallery</h1>
      <div className="grid grid-cols-3 gap-4">
        {media.map((item) => (
          <div key={item.id} className="aspect-video bg-muted rounded-lg overflow-hidden">
            {item.type === 'image' ? (
              <img src={item.url} alt="Generated image" className="object-cover w-full h-full" />
            ) : (
              <video src={item.url} controls className="w-full h-full" />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
