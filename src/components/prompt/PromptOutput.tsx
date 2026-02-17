"use client"

import { usePromptContext } from "./context"

import styles from "./prompt.module.scss"

/**
 * Displays generated output media (images / videos).
 * Shows a "Generating..." shimmer when no outputs exist yet.
 */
export default function PromptOutput() {
  const { mode, outputs } = usePromptContext()

  if (mode === "input") return null

  // Loading state
  if (mode === "loading") {
    return (
      <div className={styles.outputSection}>
        <p className={styles.loadingText}>Generating...</p>
      </div>
    )
  }

  // View / edit mode
  return (
    <div
      className={`${styles.outputSection} ${mode === "edit" ? styles.editMode : ""}`}
    >
      {outputs.length > 0 ? (
        outputs.map((m) => (
          <div key={m.id}>
            {m.type === "image" ? (
              <img
                id={m.id}
                src={m.url}
                alt=""
                className={styles.outputImage}
              />
            ) : (
              <video
                id={m.id}
                src={m.url}
                autoPlay
                loop
                muted
                className={styles.outputVideo}
              />
            )}
          </div>
        ))
      ) : (
        <p className={styles.loadingText}>Generating...</p>
      )}
    </div>
  )
}
