import { Buffer } from "node:buffer"

/**
 * Runway accepts https://, runway:// (uploads API), or data:image/… URIs.
 * Local Supabase signed URLs are often http://localhost/… — Runway rejects
 * those. The app server can still fetch them, so we inline as a data URI.
 */
export async function ensureRunwayImageUri(uri: string): Promise<string> {
  if (
    uri.startsWith("https://") ||
    uri.startsWith("runway://") ||
    uri.startsWith("data:image/")
  ) {
    return uri
  }

  if (uri.startsWith("http://")) {
    const res = await fetch(uri)
    if (!res.ok) {
      throw new Error(
        `Failed to fetch reference image for Runway (${res.status}). ` +
          "http:// URLs must be reachable from this server.",
      )
    }
    const buf = Buffer.from(await res.arrayBuffer())
    const rawCt = res.headers.get("content-type")
    const mime =
      rawCt?.split(";")[0]?.trim().replace(/\s+/g, "") || "image/png"
    if (!mime.startsWith("image/")) {
      throw new Error(
        `Reference asset must be an image (content-type was ${mime || "unknown"})`,
      )
    }
    return `data:${mime};base64,${buf.toString("base64")}`
  }

  throw new Error(
    "Runway image inputs require https://, runway:// (uploads), or data:image/ URIs.",
  )
}
