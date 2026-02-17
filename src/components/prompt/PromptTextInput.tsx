"use client"

import { useRef, useEffect } from "react"
import { Textarea } from "@/components/ui/Textarea"
import { usePromptContext } from "./context"

import styles from "./prompt.module.scss"

interface PromptTextInputProps {
  placeholder?: string
}

export default function PromptTextInput({ placeholder }: PromptTextInputProps) {
  const { mode, model, text, setText, addFiles, maxInputCount, currentInputCount } =
    usePromptContext()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const isHidden = model === "upscale_v1" || mode === "view"

  const resize = (el: HTMLTextAreaElement | null) => {
    if (!el) return
    el.style.height = "auto"
    el.style.height = el.scrollHeight + 2 + "px"
  }

  useEffect(() => {
    if (isHidden) return
    resize(textareaRef.current)
    const id = setTimeout(() => resize(textareaRef.current), 0)
    return () => clearTimeout(id)
  }, [text, mode, isHidden])

  if (isHidden) return null

  const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    resize(e.currentTarget)
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData.items
    const pastedFiles: File[] = []
    let available = maxInputCount === Infinity
      ? Infinity
      : maxInputCount - currentInputCount

    for (const item of items) {
      if (available <= 0) break
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const file = item.getAsFile()
        if (file) {
          pastedFiles.push(file)
          available--
        }
      }
    }

    if (pastedFiles.length > 0) {
      addFiles(pastedFiles)
    }
  }

  return (
    <Textarea
      ref={textareaRef}
      className={styles.textInput}
      value={text}
      name="prompt"
      maxLength={1000}
      onChange={(e) => setText(e.target.value)}
      onInput={handleInput}
      onPaste={handlePaste}
      placeholder={
        placeholder ?? (mode === "edit" ? "Edit your prompt..." : "Enter your prompt...")
      }
    />
  )
}
