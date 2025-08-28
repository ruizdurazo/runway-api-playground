"use client"

import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useState, useEffect } from "react"

export default function Sidebar() {
  const [theme, setTheme] = useState<string | undefined>(undefined)

  useEffect(() => {
    const stored = localStorage.getItem("theme") || "system"
    setTheme(stored)

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    const handleChange = () => {
      if (stored === "system") {
        const root = document.documentElement
        const systemDark = mediaQuery.matches
        if (systemDark) {
          root.classList.add("dark")
        } else {
          root.classList.remove("dark")
        }
      }
    }
    mediaQuery.addEventListener("change", handleChange)
    return () => mediaQuery.removeEventListener("change", handleChange)
  }, [])

  const setThemeFunc = (newTheme: "light" | "dark" | "system") => {
    setTheme(newTheme)
    localStorage.setItem("theme", newTheme)
    const root = document.documentElement
    if (newTheme === "light") {
      root.classList.remove("dark")
    } else if (newTheme === "dark") {
      root.classList.add("dark")
    } else {
      const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches
      if (systemDark) {
        root.classList.add("dark")
      } else {
        root.classList.remove("dark")
      }
    }
  }

  return (
    <aside className="w-64 bg-background-sidebar border-r h-screen">
      <div className="p-4">
        <h2 className="text-lg font-bold">Runway API Playground</h2>
      </div>
      <nav className="p-4">
        <ul className="space-y-2">
          <li>
            <Link href="/dashboard">
              <Button variant="ghost" className="w-full justify-start">Playground</Button>
            </Link>
          </li>
          <li>
            <Link href="/dashboard/gallery">
              <Button variant="ghost" className="w-full justify-start">Gallery</Button>
            </Link>
          </li>
          <li>
            <Link href="/dashboard/settings">
              <Button variant="ghost" className="w-full justify-start">Settings</Button>
            </Link>
          </li>
        </ul>
      </nav>
      <div className="p-4 mt-auto">
        <Select value={theme || "system"} onValueChange={setThemeFunc}>
          <SelectTrigger className="w-full justify-start">
            <SelectValue placeholder="Theme" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="light">Light</SelectItem>
            <SelectItem value="dark">Dark</SelectItem>
            <SelectItem value="system">System</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </aside>
  )
}
