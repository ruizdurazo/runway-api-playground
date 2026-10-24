"use client"

import { Input } from "@/components/ui/Input"
import { Button } from "@/components/ui/Button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select"
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
    removeExistingMedia,
    removeNewFile,
    updateTag,
    updatePosition,
  } = usePromptContext()

  if (mode === "view" || mode === "loading") return null

  const tagsAllowed =
    modelConfig.inputs.kind === "standard" && modelConfig.inputs.tagsAllowed

  const positionsRequired =
    modelConfig.inputs.kind === "standard" && modelConfig.inputs.positionsRequired

  const supportsLastFrame = modelConfig.supportsLastFrame === true
  const flexibleImageRole =
    modelConfig.inputs.kind === "standard" &&
    modelConfig.inputs.flexibleImageRole === true

  const hasExisting = existingMedia.length > 0
  const hasNew = newFiles.length > 0

  if (!hasExisting && !hasNew) return null

  return (
    <>
      {tagsAllowed && (hasExisting || hasNew) && (
        <p className={styles.referenceHint}>
          Use tag names in your prompt to reference images (e.g. &ldquo;a photo of &lt;ref1&gt;&rdquo;).
          Leave empty for auto-assigned tags.
        </p>
      )}
      {flexibleImageRole && (hasExisting || hasNew) && (
        <p className={styles.referenceHint}>
          Images are references unless you mark a first and last frame. A video switches to video-to-video.
        </p>
      )}

      <div className={styles.mediaPreviewList}>
        {existingMedia.map((m, index) => (
          <div key={`existing-${index}`} className={styles.mediaItem}>
            {m.type === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
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
            {positionsRequired && (
              <Select
                value={m.position ?? "first"}
                onValueChange={(v) =>
                  updatePosition(
                    index,
                    v === "last" ? "last" : v === "first" ? "first" : null,
                    true,
                  )
                }
              >
                <SelectTrigger className={styles.tagInput}>
                  <SelectValue placeholder="Frame" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="first">First frame</SelectItem>
                  {supportsLastFrame && (
                    <SelectItem value="last">Last frame</SelectItem>
                  )}
                </SelectContent>
              </Select>
            )}
            {flexibleImageRole && m.type === "image" && (
              <Select
                value={m.position ?? "reference"}
                onValueChange={(v) =>
                  updatePosition(
                    index,
                    v === "last" ? "last" : v === "first" ? "first" : null,
                    true,
                  )
                }
              >
                <SelectTrigger className={styles.tagInput}>
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="reference">Reference</SelectItem>
                  <SelectItem value="first">First frame</SelectItem>
                  {supportsLastFrame && (
                    <SelectItem value="last">Last frame</SelectItem>
                  )}
                </SelectContent>
              </Select>
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
              // eslint-disable-next-line @next/next/no-img-element
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
            {positionsRequired && (
              <Select
                value={item.position ?? "first"}
                onValueChange={(v) =>
                  updatePosition(
                    index,
                    v === "last" ? "last" : v === "first" ? "first" : null,
                    false,
                  )
                }
              >
                <SelectTrigger className={styles.tagInput}>
                  <SelectValue placeholder="Frame" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="first">First frame</SelectItem>
                  {supportsLastFrame && (
                    <SelectItem value="last">Last frame</SelectItem>
                  )}
                </SelectContent>
              </Select>
            )}
            {flexibleImageRole && item.file.type.startsWith("image/") && (
              <Select
                value={item.position ?? "reference"}
                onValueChange={(v) =>
                  updatePosition(
                    index,
                    v === "last" ? "last" : v === "first" ? "first" : null,
                    false,
                  )
                }
              >
                <SelectTrigger className={styles.tagInput}>
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="reference">Reference</SelectItem>
                  <SelectItem value="first">First frame</SelectItem>
                  {supportsLastFrame && (
                    <SelectItem value="last">Last frame</SelectItem>
                  )}
                </SelectContent>
              </Select>
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
