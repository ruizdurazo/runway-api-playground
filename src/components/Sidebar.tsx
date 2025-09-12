"use client"

import { Button } from "@/components/ui/Button"
import Link from "next/link"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select"
import { useState, useEffect } from "react"
import styles from "./Sidebar.module.scss"
import { usePathname } from "next/navigation"
import { RunwayLogo } from "@/assets/RunwayLogo"

export default function Sidebar() {
  const [theme, setTheme] = useState<string | undefined>(undefined)
  const pathname = usePathname()

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
      const systemDark = window.matchMedia(
        "(prefers-color-scheme: dark)",
      ).matches
      if (systemDark) {
        root.classList.add("dark")
      } else {
        root.classList.remove("dark")
      }
    }
  }

  return (
    <aside className={styles.sidebar}>
      {/* Header */}
      <div>
        <div className={styles.sidebarHeader}>
          <RunwayLogo className={styles.sidebarLogo} />
        </div>

        {/* Divider */}
        <div className={styles.sidebarDivider} />

        {/* Nav */}
        <nav className={styles.sidebarNav}>
          <ul className={styles.sidebarList}>
            <li>
              <Link href="/dashboard">
                <Button
                  variant="ghost"
                  className={`${styles.sidebarButton} ${pathname === "/dashboard" || pathname.startsWith("/dashboard/chat/") ? styles.active : ""}`}
                >
                  Playground
                </Button>
              </Link>
            </li>
            <li>
              <Link href="/dashboard/gallery">
                <Button
                  variant="ghost"
                  className={`${styles.sidebarButton} ${pathname === "/dashboard/gallery" ? styles.active : ""}`}
                >
                  Gallery
                </Button>
              </Link>
            </li>
            <li>
              <Link href="/dashboard/settings">
                <Button
                  variant="ghost"
                  className={`${styles.sidebarButton} ${pathname === "/dashboard/settings" ? styles.active : ""}`}
                >
                  Settings
                </Button>
              </Link>
            </li>
          </ul>
        </nav>
      </div>

      {/* Footer */}
      <div className={styles.sidebarFooter}>
        <ul className={styles.sidebarList}>
          <li>
            <Link href="https://dev.runwayml.com/" target="_blank">
              <Button variant="ghost" className={`${styles.sidebarButton}`}>
                Runway API ↗
              </Button>
            </Link>
          </li>
          <li>
            <Link href="https://docs.dev.runwayml.com/" target="_blank">
              <Button variant="ghost" className={`${styles.sidebarButton}`}>
                API Docs ↗
              </Button>
            </Link>
          </li>
          <li>
            <Link href="https://docs.dev.runwayml.com/api" target="_blank">
              <Button variant="ghost" className={`${styles.sidebarButton}`}>
                API Reference ↗
              </Button>
            </Link>
          </li>
        </ul>
        {/* Theme Select */}
        <Select value={theme || "system"} onValueChange={setThemeFunc}>
          <SelectTrigger className={styles.sidebarSelectTrigger}>
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
