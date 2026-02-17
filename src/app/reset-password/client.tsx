"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Label } from "@/components/ui/Label"
import { supabase } from "@/lib/supabase"

import styles from "./page.module.scss"

import { RunwayLogo } from "@/assets/RunwayLogo"

export default function ResetPasswordClient() {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password !== confirmPassword) {
      toast.error("Passwords do not match.")
      return
    }

    setIsSubmitting(true)

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      toast.error(error.message)
    } else {
      toast.success("Password updated successfully.")
      router.push("/login")
    }

    setIsSubmitting(false)
  }

  return (
    <div className={styles.container}>
      {/* Left: Hero */}
      <div className={styles.hero}>
        <video
          src="/runwayhero.mp4"
          autoPlay
          loop
          muted
          playsInline
          className={styles.video}
        />
        <RunwayLogo className={styles.logo} />
      </div>

      {/* Right: Form */}
      <div className={styles.auth}>
        <div className={styles.authWrapper}>
          <h1 className={styles.title}>Runway API Playground</h1>

          <div className={styles.subtitleWrapper}>
            <h2 className={styles.subtitle}>Set a new password</h2>
            <p className={styles.description}>
              Enter your new password below.
            </p>
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.field}>
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <Button
              type="submit"
              className={styles.submitButton}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Updating..." : "Update password"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
