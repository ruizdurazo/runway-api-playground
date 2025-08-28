"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardContent } from "@/components/ui/card"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

interface Chat {
  id: string
  created_at: string
}

export default function ChatsPage() {
  const [chats, setChats] = useState<Chat[]>([])
  const router = useRouter()

  useEffect(() => {
    const fetchChats = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase.from("chats").select("*").eq("user_id", user.id).order("created_at", { ascending: false })
        setChats(data || [])
      }
    }
    fetchChats()
  }, [])

  const createNewChat = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data, error } = await supabase.from("chats").insert({ user_id: user.id }).select()
      if (error) console.error(error)
      else router.push(`/dashboard/chat/${data[0].id}`)
    }
  }

  const handleDelete = async (chatId: string) => {
    if (!window.confirm("Are you sure you want to delete this chat and all associated prompts and media?")) return;

    try {
      // Fetch prompts
      const { data: prompts, error: pError } = await supabase.from("prompts").select("id").eq("chat_id", chatId);
      if (pError) throw pError;

      const promptIds = prompts?.map((p) => p.id) ?? [];

      // Fetch media paths
      const { data: media, error: mError } = await supabase.from("media").select("path").in("prompt_id", promptIds);
      if (mError) throw mError;

      // Delete files from storage
      for (const { path } of media ?? []) {
        const { error: delError } = await supabase.storage.from("media").remove([path]);
        if (delError) console.error("Error deleting file:", delError);
      }

      // Delete the chat (cascade will handle prompts and media rows)
      const { error: chatError } = await supabase.from("chats").delete().eq("id", chatId);
      if (chatError) throw chatError;

      // Update state
      setChats(chats.filter((c) => c.id !== chatId));
      toast.success("Chat deleted successfully");
    } catch (error) {
      console.error("Error deleting chat:", error);
      toast.error("Failed to delete chat");
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">My Chats</h1>
        <Button onClick={createNewChat}>New Chat</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {chats.map((chat) => (
          <Link key={chat.id} href={`/dashboard/chat/${chat.id}`}>
            <Card className="cursor-pointer hover:shadow-md">
              <CardHeader>
                <h3 className="font-semibold">Chat {chat.id}</h3>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Created: {new Date(chat.created_at).toLocaleString()}</p>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDelete(chat.id);
                  }}
                  className="mt-2"
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
