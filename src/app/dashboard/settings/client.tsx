"use client"

import { Input } from "@/components/ui/Input"
import { Button } from "@/components/ui/Button"
import { Label } from "@/components/ui/Label"
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

import styles from "./page.module.scss"

export default function SettingsClient() {
  const [name, setName] = useState("")
  const [apiKey, setApiKey] = useState("")
  const router = useRouter()

  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
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
      data: { name, runway_api_key: apiKey },
    })
    if (error) {
      toast.error(error.message)
    } else {
      toast.success("Settings updated.")
    }
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>User Settings</h1>
      <form className={styles.settingsForm} onSubmit={handleSubmit}>
        <div>
          <Label htmlFor="name">User Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="api-key">Runway API Key</Label>
          <Input
            id="api-key"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>
        <Button type="submit">Save</Button>
        <Button
          variant="ghost"
          onClick={async () => {
            await supabase.auth.signOut()
            router.push("/login")
          }}
        >
          Logout
        </Button>
      </form>
    </div>
  )
}
