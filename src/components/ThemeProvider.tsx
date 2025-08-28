"use client"

import { useEffect } from "react"

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const root = document.documentElement

    const setTheme = (theme: "light" | "dark" | "system") => {
      localStorage.setItem("theme", theme)
      if (theme === "light") {
        root.classList.remove("dark")
      } else if (theme === "dark") {
        root.classList.add("dark")
      } else { // system
        const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches
        if (systemDark) {
          root.classList.add("dark")
        } else {
          root.classList.remove("dark")
        }
      }
    }

    const stored = localStorage.getItem("theme")
    setTheme((stored as "light" | "dark" | "system") || "system")

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    const handleChange = () => {
      if (localStorage.getItem("theme") === "system") {
        setTheme("system")
      }
    }
    mediaQuery.addEventListener("change", handleChange)
    return () => mediaQuery.removeEventListener("change", handleChange)
  }, [])

  return <>{children}</>
}
