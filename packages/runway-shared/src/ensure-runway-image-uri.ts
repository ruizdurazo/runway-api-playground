import { Buffer } from "node:buffer"
import { toFile, type RunwayML } from "@runwayml/sdk"

const MIME_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
}

/**
 * Runway accepts https://, runway://, or small data: URIs.
 * Local Supabase signed URLs are http://localhost/… and cannot be fetched by
 * Runway. Inlining them as base64 makes the generation body exceed the API
 * gateway limit, so those files are uploaded and replaced with a runway:// URI.
 */
export async function ensureRunwayImageUri(
  uri: string,
  client: RunwayML,
): Promise<string> {
  if (
    uri.startsWith("https://") ||
    uri.startsWith("runway://") ||
    uri.startsWith("data:")
  ) {
    return uri
  }

  if (!uri.startsWith("http://")) {
    throw new Error(
      "Runway media inputs require https://, runway://, or data: URIs.",
    )
  }

  const res = await fetch(uri)
  if (!res.ok) {
    throw new Error(
      `Failed to fetch media for Runway (${res.status}). ` +
        "http:// URLs must be reachable from this server.",
    )
  }

  const buf = Buffer.from(await res.arrayBuffer())
  const mime =
    res.headers.get("content-type")?.split(";")[0]?.trim().replace(/\s+/g, "") ||
    "application/octet-stream"
  const file = await toFile(buf, filenameFromUri(uri, mime), { type: mime })
  const uploaded = await client.uploads.createEphemeral({ file })
  return uploaded.uri
}

function filenameFromUri(uri: string, mime: string): string {
  try {
    const base = decodeURIComponent(new URL(uri).pathname).split("/").pop() ?? ""
    if (/^[^/\\]+\.[a-z0-9]{2,5}$/i.test(base)) {
      return base.slice(0, 255)
    }
  } catch {
    // Fall through to a generated name.
  }
  const ext = MIME_EXTENSIONS[mime] ?? (mime.startsWith("video/") ? "mp4" : "png")
  return `upload.${ext}`
}
