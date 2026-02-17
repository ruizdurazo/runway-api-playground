"use client"

import { usePromptContext } from "./context"

import styles from "./prompt.module.scss"

/**
 * Displays prompt text and input media in view mode.
 * Shown as an overlay at the bottom of the card when hovering.
 */
export default function PromptHeader() {
  const { mode, prompt } = usePromptContext()

  if (mode !== "view" || !prompt) return null

  const inputMedia = prompt.media?.filter((m) => m.category === "input") ?? []

  return (
    <div className={styles.inputSection}>
      {inputMedia.length > 0 && (
        <div className={styles.inputMediaList}>
          {inputMedia.map((m, index) => (
            <div key={index} className={styles.inputMediaItem}>
              {m.type === "image" ? (
                <img src={m.url} alt="" className={styles.inputImage} />
              ) : (
                <video src={m.url} autoPlay loop muted className={styles.inputVideo} />
              )}
            </div>
          ))}
        </div>
      )}
      <p className={styles.promptText}>{prompt.prompt_text}</p>
    </div>
  )
}
