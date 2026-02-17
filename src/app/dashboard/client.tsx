"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/Button"
import { Card, CardContent } from "@/components/ui/Card"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu"
import type { RealtimeChannel } from "@supabase/supabase-js"

import styles from "./page.module.scss"
import { formatRelativeTime } from "@/lib/utils"

interface Chat {
  id: string
  updated_at: string
}

export default function DashboardClient() {
  const [chats, setChats] = useState<Chat[]>([])
  const [currentTime, setCurrentTime] = useState(new Date())
  const [chatDetails, setChatDetails] = useState<
    Record<
      string,
      { url: string | null; type: "image" | "video" | null; count: number }
    >
  >({})
  const router = useRouter()

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const fetchChats = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase
          .from("chats")
          .select("*")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false })
        setChats(data || [])
      }
    }
    fetchChats()
  }, [])

  // Debug: Log when chats state changes
  useEffect(() => {
    console.log("Chats state updated:", chats.length, "chats")
    console.log(
      "Chat IDs:",
      chats.map((c) => c.id),
    )
  }, [chats])

  useEffect(() => {
    const fetchChatDetails = async () => {
      const mediaPromises = chats.map(async (chat) => {
        const { data: prompts, error: promptError } = await supabase
          .from("prompts")
          .select("id")
          .eq("chat_id", chat.id)
        if (promptError || !prompts) {
          return { chatId: chat.id, url: null, type: null, count: 0 }
        }
        const count = prompts.length
        if (count === 0) {
          return { chatId: chat.id, url: null, type: null, count: 0 }
        }
        const promptIds = prompts.map((p) => p.id)
        const { data, error } = await supabase
          .from("media")
          .select("path, type")
          .in("prompt_id", promptIds)
          .eq("category", "output")
          .order("created_at", { ascending: false })
          .limit(1)
          .single()
        if (error || !data) {
          return { chatId: chat.id, url: null, type: null, count }
        }
        const signed = await supabase.storage
          .from("media")
          .createSignedUrl(data.path, 3600)
        if (signed.error || !signed.data) {
          return { chatId: chat.id, url: null, type: null, count }
        }
        return {
          chatId: chat.id,
          url: signed.data.signedUrl,
          type: data.type,
          count,
        }
      })
      const results = await Promise.all(mediaPromises)
      const mediaMap = results.reduce(
        (acc, { chatId, url, type, count }) => {
          acc[chatId] = { url, type, count }
          return acc
        },
        {} as Record<
          string,
          { url: string | null; type: "image" | "video" | null; count: number }
        >,
      )
      setChatDetails(mediaMap)
    }
    if (chats.length > 0) {
      fetchChatDetails()
    }
  }, [chats])

  useEffect(() => {
    let channel: RealtimeChannel | undefined
    ;(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return
      channel = supabase.channel("chats-realtime")
      console.log("Setting up real-time subscription for user:", user.id)
      channel
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "chats",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            console.log("INSERT CHAT", payload)
            console.log("INSERT CHAT new:", payload.new)
            console.log("Payload keys:", Object.keys(payload))
            console.log(
              "New chat keys:",
              payload.new ? Object.keys(payload.new) : "undefined",
            )

            if (payload.new && payload.new.id && payload.new.updated_at) {
              setChats((prev) => {
                // Skip if already present (optimistic update may have added it)
                if (prev.some((c) => c.id === payload.new.id)) return prev
                const newChat = { ...payload.new } as Chat
                return [newChat, ...prev].sort(
                  (a, b) =>
                    new Date(b.updated_at).getTime() -
                    new Date(a.updated_at).getTime(),
                )
              })
            }
          },
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "chats",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            console.log("UPDATE CHAT", payload)
            console.log("UPDATE CHAT new:", payload.new)
            console.log("Payload keys:", Object.keys(payload))

            if (payload.new && payload.new.id && payload.new.updated_at) {
              setChats((prev) => {
                const updatedChat = { ...payload.new } as Chat
                const updatedChats = prev
                  .map((c) =>
                    c.id === updatedChat.id ? { ...updatedChat } : c,
                  )
                  .sort(
                    (a, b) =>
                      new Date(b.updated_at).getTime() -
                      new Date(a.updated_at).getTime(),
                  )
                console.log("Chat updated:", updatedChat.id)
                return updatedChats
              })
              console.log("UI updated with updated chat")
            } else {
              console.error("Invalid payload structure for UPDATE:", payload)
            }
          },
        )
        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table: "chats",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            console.log("DELETE CHAT", payload)
            console.log("DELETE CHAT old:", payload.old)
            setChats((prev) => prev.filter((c) => c.id !== payload.old.id))
          },
        )
        .subscribe((status) => {
          console.log("Subscription status:", status)
        })
    })()
  }, [])

  const createNewChat = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      const { data, error } = await supabase
        .from("chats")
        .insert({ user_id: user.id })
        .select()
      if (error) console.error(error)
      else {
        console.log("Chat created locally:", data[0])
        // Update local state immediately to prevent UI lag
        setChats((prev) =>
          [{ ...data[0] }, ...prev].sort(
            (a, b) =>
              new Date(b.updated_at).getTime() -
              new Date(a.updated_at).getTime(),
          ),
        )
        router.push(`/dashboard/chat/${data[0].id}`)
      }
    }
  }

  const handleDelete = async (chatId: string) => {
    try {
      // Fetch prompts
      const { data: prompts, error: pError } = await supabase
        .from("prompts")
        .select("id")
        .eq("chat_id", chatId)
      if (pError) throw pError

      const promptIds = prompts?.map((p) => p.id) ?? []

      // Fetch media paths
      const { data: media, error: mError } = await supabase
        .from("media")
        .select("path")
        .in("prompt_id", promptIds)
      if (mError) throw mError

      // Delete files from storage
      for (const { path } of media ?? []) {
        const { error: delError } = await supabase.storage
          .from("media")
          .remove([path])
        if (delError) console.error("Error deleting file:", delError)
      }

      // Delete the chat (cascade will handle prompts and media rows)
      const { error: chatError } = await supabase
        .from("chats")
        .delete()
        .eq("id", chatId)
      if (chatError) throw chatError

      // Update state
      setChats(chats.filter((c) => c.id !== chatId))
      toast.success("Chat deleted successfully")
    } catch (error) {
      console.error("Error deleting chat:", error)
      toast.error("Failed to delete chat")
    }
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>Prompt Playground</h1>
        <Button onClick={createNewChat}>New Chat</Button>
      </div>

      {/* Chat Grid */}
      <div className={styles.chatGrid}>
        {chats.map((chat) => {
          const details = chatDetails[chat.id]
          return (
            <Link key={chat.id} href={`/dashboard/chat/${chat.id}`}>
              <Card className={styles.chatCard}>
                <CardContent className={styles.chatCardContent}>
                  <div className={styles.mediaPreview}>
                    {(() => {
                      if (details === undefined) {
                        return <div className={styles.loadingPreview} />
                      } else if (details?.url != null && details.type != null) {
                        return details.type === "image" ? (
                          <img
                            src={details.url}
                            alt=""
                            className={styles.previewImage}
                          />
                        ) : (
                          <video
                            src={details.url}
                            className={styles.previewVideo}
                            muted
                            loop
                            autoPlay
                            playsInline
                          />
                        )
                      } else {
                        return (
                          <div className={styles.noMedia}>No media yet</div>
                        )
                      }
                    })()}
                  </div>

                  {/* Prompt count */}
                  <p className={styles.promptCount}>
                    {details?.count ?? 0} prompt
                    {(details?.count ?? 0) === 1 ? "" : "s"}
                  </p>

                  {/* Last updated */}
                  <p className={styles.chatDate}>
                    {formatRelativeTime(new Date(chat.updated_at), currentTime)}
                  </p>

                  {/* Dropdown menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={styles.menuTrigger}
                      >
                        ⋮
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(chat.id)
                        }}
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
