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

export default function LoginClient() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin")
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      })
      if (error) {
        toast.error(error.message)
      } else {
        toast.success("Check your email for the password reset link.")
      }
    } else if (mode === "signin") {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) {
        toast.error(error.message)
      } else {
        router.push("/dashboard")
      }
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name },
        },
      })
      if (error) {
        toast.error(error.message)
      } else if (data.user?.identities?.length === 0) {
        toast.error("An account with this email already exists.")
      } else if (data.session) {
        router.push("/dashboard")
      } else {
        toast.success("Check your email for the confirmation link.")
      }
    }
  }

  return (
    <div className={styles.container}>
      {/* Left: Hero */}
      <div className={styles.hero}>
        {/* Video */}
        <video
          src="/runwayhero.mp4"
          autoPlay
          loop
          muted
          playsInline
          className={styles.video}
        />
        {/* Logo */}
        <RunwayLogo className={styles.logo} />
      </div>

      {/* Right: Auth Wrapper */}
      <div className={styles.auth}>
        <div className={styles.authWrapper}>
          <h1 className={styles.title}>Runway API Playground</h1>

          <div className={styles.subtitleWrapper}>
            <h2 className={styles.subtitle}>
              {mode === "signin"
                ? "Log in"
                : mode === "signup"
                  ? "Create an account"
                  : "Reset your password"}
            </h2>
            {mode === "signup" && (
              <p className={styles.description}>
                You will need an API key from Runway to use the API Playground.
              </p>
            )}
            {mode === "forgot" && (
              <p className={styles.description}>
                Enter your email and we'll send you a link to reset your
                password.
              </p>
            )}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className={styles.form}>
            {mode === "signup" && (
              <div className={styles.field}>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            )}
            <div className={styles.field}>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {mode !== "forgot" && (
              <div className={styles.field}>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            )}
            {mode === "signin" && (
              <button
                type="button"
                className={styles.forgotLink}
                onClick={() => setMode("forgot")}
              >
                Forgot password?
              </button>
            )}
            <Button type="submit" className={styles.submitButton}>
              {mode === "signin"
                ? "Log in"
                : mode === "signup"
                  ? "Sign up"
                  : "Send reset link"}
            </Button>
          </form>
          <p className={styles.switch}>
            {mode === "signin" ? (
              <>
                Don&apos;t have an account?{" "}
                <button
                  className={styles.link}
                  onClick={() => setMode("signup")}
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                {mode === "forgot" ? "Remember your password?" : "Already have an account?"}{" "}
                <button
                  className={styles.link}
                  onClick={() => setMode("signin")}
                >
                  Log in
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}
