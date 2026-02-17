"use client"

import { useParams } from "next/navigation"
import { usePrompts } from "@/lib/hooks/usePrompts"
import { useRealtimeSync } from "@/lib/hooks/useRealtimeSync"
import { Prompt } from "@/components/prompt"

import styles from "./page.module.scss"

export default function ChatClient() {
  const { id } = useParams()
  const chatId = id as string

  const {
    prompts,
    setPrompts,
    promptIdsRef,
    fetchSinglePrompt,
    createPrompt,
    updatePrompt,
    regeneratePrompt,
    deletePrompt,
  } = usePrompts(chatId)

  useRealtimeSync({
    chatId,
    promptIdsRef,
    fetchSinglePrompt,
    setPrompts,
  })

  return (
    <div className={styles.chatContainer}>
      {/* Prompt list */}
      <div className={styles.promptList}>
        {prompts.map((prompt) => (
          <Prompt.Root
            key={prompt.id}
            id={prompt.id}
            prompt={prompt}
            onEdit={updatePrompt}
            onDelete={deletePrompt}
            onRegenerate={regeneratePrompt}
          >
            {/* Each sub-component is mode-aware and self-hides when not relevant */}
            <Prompt.Output />
            <Prompt.Header />
            <Prompt.MediaItem />
            <Prompt.TextInput />
            <Prompt.MediaInput />
            <div className={styles.promptActions}>
              <Prompt.GenerationTypeToggle />
              <Prompt.ModelSelect />
              <Prompt.RatioSelect />
              <Prompt.DurationSelect />
              <Prompt.Actions />
            </div>
          </Prompt.Root>
        ))}
      </div>

      {/* New prompt input */}
      <div className={styles.newPromptSection}>
        <Prompt.Root key="new" onGenerate={createPrompt}>
          <Prompt.MediaItem />
          <Prompt.TextInput placeholder="Enter your prompt..." />
          <Prompt.MediaInput />
          <div className={styles.promptActions}>
            <Prompt.GenerationTypeToggle />
            <Prompt.ModelSelect />
            <Prompt.RatioSelect />
            <Prompt.DurationSelect />
            <Prompt.Actions />
          </div>
        </Prompt.Root>
      </div>
    </div>
  )
}

// Re-export shared Prompt type for backwards compatibility
export type { Prompt as PromptType } from "@/lib/types"
