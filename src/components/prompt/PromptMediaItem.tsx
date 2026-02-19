"use client"

import { Input } from "@/components/ui/Input"
import { Button } from "@/components/ui/Button"
import { usePromptContext } from "./context"

import styles from "./prompt.module.scss"

/**
 * Renders preview lists for both existing media and newly added files.
 * Adapts tag editing based on model config.
 */
export default function PromptMediaItem() {
  const {
    mode,
    modelConfig,
    existingMedia,
    newFiles,
    showReferences,
    removeExistingMedia,
    removeNewFile,
    updateTag,
  } = usePromptContext()

  if (mode === "view" || mode === "loading") return null

  const tagsAllowed =
    modelConfig.inputs.kind === "standard" && modelConfig.inputs.tagsAllowed

  const hasExisting = existingMedia.length > 0
  const hasNew = newFiles.length > 0

  if (!hasExisting && !hasNew) return null
  if (!showReferences && !hasExisting) return null

  return (
    <>
      {tagsAllowed && (hasExisting || hasNew) && (
        <p className={styles.referenceHint}>
          Use tag names in your prompt to reference images (e.g. &ldquo;a photo of &lt;ref1&gt;&rdquo;).
          Leave empty for auto-assigned tags.
        </p>
      )}

      <div className={styles.mediaPreviewList}>
        {existingMedia.map((m, index) => (
          <div key={`existing-${index}`} className={styles.mediaItem}>
            {m.type === "image" ? (
              <img src={m.url} alt="" className={styles.previewMedia} />
            ) : (
              <video src={m.url} className={styles.previewMedia} />
            )}
            {tagsAllowed && (
              <Input
                value={m.tag ?? ""}
                onChange={(e) => updateTag(index, e.target.value, true)}
                placeholder={`ref${index + 1}`}
                maxLength={16}
                className={styles.tagInput}
              />
            )}
            <Button
              type="button"
              className={styles.removeReferenceButton}
              size="sm"
              onClick={() => removeExistingMedia(index)}
            >
              x
            </Button>
          </div>
        ))}

        {newFiles.map((item, index) => (
          <div key={`new-${index}`} className={styles.mediaItem}>
            {item.file.type.startsWith("image/") ? (
              <img src={item.preview} alt="" className={styles.previewMedia} />
            ) : (
              <video src={item.preview} className={styles.previewMedia} />
            )}
            {tagsAllowed && (
              <Input
                value={item.tag}
                onChange={(e) => updateTag(index, e.target.value, false)}
                placeholder={`ref${existingMedia.length + index + 1}`}
                maxLength={16}
                className={styles.tagInput}
              />
            )}
            <Button
              type="button"
              className={styles.removeReferenceButton}
              size="sm"
              onClick={() => removeNewFile(index)}
            >
              x
            </Button>
          </div>
        ))}
      </div>
    </>
  )
}
