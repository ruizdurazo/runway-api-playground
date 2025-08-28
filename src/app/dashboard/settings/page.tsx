"use client"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"

export default function SettingsPage() {
  const [name, setName] = useState("")
  const [apiKey, setApiKey] = useState("")

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setName(user.user_metadata?.name || "")
        setApiKey(user.user_metadata?.runway_api_key || "")
      }
    }
    fetchUser()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const { error } = await supabase.auth.updateUser({
      data: { name, runway_api_key: apiKey }
    })
    if (error) {
      toast.error(error.message)
    } else {
      toast.success("Settings updated.")
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Settings</h1>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <Label htmlFor="name">Name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="api-key">Runway API Key</Label>
          <Input id="api-key" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
        </div>
        <Button type="submit">Save</Button>
      </form>
    </div>
  )
}
