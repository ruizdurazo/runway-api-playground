"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/Button"
import { Card, CardHeader, CardContent } from "@/components/ui/Card"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import styles from "./page.module.scss"
import { formatRelativeTime } from "@/lib/utils"

interface Chat {
  id: string
  updated_at: string
}

export default function DashboardClient() {
  const [chats, setChats] = useState<Chat[]>([])
  const [currentTime, setCurrentTime] = useState(new Date())
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
      else router.push(`/dashboard/chat/${data[0].id}`)
    }
  }

  const handleDelete = async (chatId: string) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this chat and all associated prompts and media?",
      )
    )
      return

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
      <div className={styles.header}>
        <h1 className={styles.title}>Prompt Playground</h1>
        <Button onClick={createNewChat}>New Chat</Button>
      </div>
      <div className={styles.chatGrid}>
        {chats.map((chat) => (
          <Link key={chat.id} href={`/dashboard/chat/${chat.id}`}>
            <Card className={styles.chatCard}>
              <CardHeader>
                <h3 className={styles.chatTitle}>Chat {chat.id}</h3>
              </CardHeader>
              <CardContent>
                <p className={styles.chatDate}>
                  Last updated: {formatRelativeTime(new Date(chat.updated_at), currentTime)}
                </p>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleDelete(chat.id)
                  }}
                  className={styles.deleteButton}
                >
                  Delete
                </Button>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
