import React, { useEffect, useRef, useState } from "react"
import { McpUseProvider, useWidget, type WidgetMetadata } from "mcp-use/react"
import { z } from "zod"

export const propSchema = z.object({
  url: z.string(),
  mediaType: z.enum(["image", "video"]),
  model: z.string(),
  generationType: z.enum(["image", "video"]),
  ratio: z.string(),
  /** Injected by the MCP server so the widget can call `/__media-proxy` when the iframe has an opaque origin. */
  mcpHttpOrigin: z.string().optional(),
  /** Injected for images when the host blocks cross-origin HTTP previews (e.g. HTTPS inspector → `http://localhost` proxy). */
  previewDataUrl: z.string().optional(),
})

export type GenerationResultProps = z.infer<typeof propSchema>

export const widgetMetadata: WidgetMetadata = {
  description: "Shows Runway generation output with preview and open-in-browser.",
  props: propSchema,
  exposeAsTool: false,
  metadata: {
    csp: {
      connectDomains: [
        "https://api.dev.runwayml.com",
        "https://api.runwayml.com",
        "https://storage.googleapis.com",
        "https://*.cloudfront.net",
        "https://dnznrvs05pmza.cloudfront.net",
      ],
      resourceDomains: [
        "https://api.dev.runwayml.com",
        "https://api.runwayml.com",
        "https://storage.googleapis.com",
        "https://media.runwayml.com",
        "https://*.cloudfront.net",
        "https://dnznrvs05pmza.cloudfront.net",
      ],
    },
    prefersBorder: true,
    invoking: "Generating media…",
    invoked: "Generation complete",
    widgetDescription: "Preview Runway image or video output with open-in-browser.",
  },
}

const cardStyle: React.CSSProperties = {
  fontFamily: "system-ui, sans-serif",
  padding: "16px",
  // borderRadius: "12px",
  // border: "1px solid color-mix(in srgb, CanvasText 12%, transparent)",
  maxWidth: "100%",
}

const metaStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "color-mix(in srgb, CanvasText 70%, transparent)",
  marginBottom: "12px",
  lineHeight: 1.5,
}

const buttonStyle: React.CSSProperties = {
  marginTop: "12px",
  padding: "8px 14px",
  borderRadius: "8px",
  border: "1px solid color-mix(in srgb, CanvasText 20%, transparent)",
  background: "Canvas",
  cursor: "pointer",
  fontSize: "14px",
}

async function copyTextToClipboard(value: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value)
      return true
    }
  } catch {
    /* fall back below */
  }

  if (typeof document === "undefined") return false

  try {
    const textarea = document.createElement("textarea")
    textarea.value = value
    textarea.setAttribute("readonly", "")
    textarea.style.position = "absolute"
    textarea.style.left = "-9999px"
    document.body.appendChild(textarea)
    textarea.select()
    const copied = document.execCommand("copy")
    document.body.removeChild(textarea)
    return copied
  } catch {
    return false
  }
}

type McpHttpOriginSource =
  | "props"
  | "location"
  | "mcp_url"
  | "script-src"
  | "base-uri"
  | "none"

function tryHttpOriginFromHref(href: string): string {
  try {
    const u = new URL(href)
    if (u.protocol !== "http:" && u.protocol !== "https:") return ""
    if (u.origin === "null") return ""
    return u.origin
  } catch {
    return ""
  }
}

/**
 * HTTP origin of the MCP server for same-origin `/__media-proxy`.
 * MCP Use inspector / sandboxed frames often expose `window.location.origin === "null"` (opaque origin);
 * then we derive the host from `useWidget().mcp_url` or the widget module script URL vs `document.baseURI`.
 */
function resolveMcpHttpOrigin(
  mcpBase: string,
  propOrigin?: string,
): {
  origin: string
  source: McpHttpOriginSource
} {
  if (typeof window === "undefined") {
    return { origin: "", source: "none" }
  }

  const trimmedProp = propOrigin?.trim() ?? ""
  if (trimmedProp) {
    const fromProp = tryHttpOriginFromHref(trimmedProp)
    if (fromProp) return { origin: fromProp, source: "props" }
  }

  try {
    const lo = window.location.origin
    if (lo && lo !== "null") {
      const fromLoc = tryHttpOriginFromHref(window.location.href)
      if (fromLoc) return { origin: fromLoc, source: "location" }
    }
  } catch {
    /* ignore */
  }

  const trimmed = mcpBase.trim().replace(/\/$/, "")
  if (trimmed) {
    try {
      const lower = trimmed.toLowerCase()
      const abs =
        lower.startsWith("http://") || lower.startsWith("https://")
          ? trimmed
          : lower.startsWith("localhost:") ||
              lower.startsWith("127.0.0.1:") ||
              lower === "localhost" ||
              lower.startsWith("0.0.0.0:")
            ? `http://${trimmed}`
            : `https://${trimmed}`
      const fromMcp = tryHttpOriginFromHref(abs)
      if (fromMcp) return { origin: fromMcp, source: "mcp_url" }
    } catch {
      /* ignore */
    }
  }

  const scripts = document.querySelectorAll("script[type=\"module\"][src]")
  for (let i = 0; i < scripts.length; i++) {
    const src = scripts[i]?.getAttribute("src")
    if (!src) continue
    const fromScript = tryHttpOriginFromHref(new URL(src, document.baseURI).href)
    if (fromScript) return { origin: fromScript, source: "script-src" }
  }

  const fromBase = tryHttpOriginFromHref(document.baseURI)
  if (fromBase) return { origin: fromBase, source: "base-uri" }

  return { origin: "", source: "none" }
}

function buildProxiedMediaSrc(
  remoteUrl: string,
  mcpBase: string,
  propOrigin?: string,
): string {
  const { origin } = resolveMcpHttpOrigin(mcpBase, propOrigin)
  if (!origin) return remoteUrl
  return `${origin.replace(/\/$/, "")}/__media-proxy?u=${encodeURIComponent(remoteUrl)}`
}

const GenerationResult: React.FC = () => {
  const { props, isPending, mcp_url: mcpBaseUrl } = useWidget<GenerationResultProps>()
  const [previewFailed, setPreviewFailed] = useState(false)
  const [clientBlobSrc, setClientBlobSrc] = useState<string | null>(null)
  const [copyState, setCopyState] = useState<"idle" | "success" | "error">("idle")
  const blobRef = useRef<string | null>(null)
  const copyResetTimeoutRef = useRef<number | null>(null)

  /** When server omits `previewDataUrl` (size / wire limits), fetch artifact with `connect-src` then show via blob URL. */
  useEffect(() => {
    const revoke = () => {
      if (blobRef.current) {
        URL.revokeObjectURL(blobRef.current)
        blobRef.current = null
      }
    }
    revoke()
    setClientBlobSrc(null)

    if (isPending || !props?.url || props.mediaType !== "image" || props.previewDataUrl) {
      return
    }

    let cancelled = false
    const imageUrl = props.url

    ;(async () => {
      try {
        const res = await fetch(imageUrl, { mode: "cors", credentials: "omit" })
        if (!res.ok || cancelled) {
          return
        }
        const blob = await res.blob()
        if (cancelled) return
        const u = URL.createObjectURL(blob)
        blobRef.current = u
        setClientBlobSrc(u)
      } catch {
        /* CORS or network */
      }
    })()

    return () => {
      cancelled = true
      revoke()
    }
  }, [isPending, props?.url, props?.mediaType, props?.previewDataUrl])

  useEffect(() => {
    setPreviewFailed(false)
  }, [props?.url])

  useEffect(() => {
    setCopyState("idle")
  }, [props?.url])

  useEffect(() => {
    return () => {
      if (copyResetTimeoutRef.current !== null) {
        window.clearTimeout(copyResetTimeoutRef.current)
      }
    }
  }, [])

  if (isPending) {
    return (
      <McpUseProvider autoSize>
        <div style={cardStyle}>Generating…</div>
      </McpUseProvider>
    )
  }

  if (!props?.url) {
    return (
      <McpUseProvider autoSize>
        <div style={cardStyle}>
          <p style={metaStyle}>
            No media URL in the tool result. If this persists, check that the
            server returns <code>structuredContent</code> with{" "}
            <code>url</code> from <code>generate_media</code>.
          </p>
        </div>
      </McpUseProvider>
    )
  }

  const { url, mediaType, model, generationType, ratio, previewDataUrl } = props
  const ratioLabel = ratio || "—"
  const mediaSrc =
    mediaType === "image"
      ? previewDataUrl || clientBlobSrc || buildProxiedMediaSrc(url, mcpBaseUrl || "", props.mcpHttpOrigin)
      : buildProxiedMediaSrc(url, mcpBaseUrl || "", props.mcpHttpOrigin)

  const handleCopyUrl = async () => {
    if (copyResetTimeoutRef.current !== null) {
      window.clearTimeout(copyResetTimeoutRef.current)
      copyResetTimeoutRef.current = null
    }

    const copied = await copyTextToClipboard(url)
    setCopyState(copied ? "success" : "error")

    if (copied) {
      copyResetTimeoutRef.current = window.setTimeout(() => {
        setCopyState("idle")
        copyResetTimeoutRef.current = null
      }, 3000)
    }
  }

  return (
    <McpUseProvider autoSize>
      <div style={cardStyle}>
        <div style={metaStyle}>
          <strong>{mediaType}</strong>
          {" · "}
          model <code>{model}</code>
          {" · "}
          {generationType}
          {" · "}
          ratio {ratioLabel}
        </div>

        {mediaType === "image" && !previewFailed ? (
          <img
            src={mediaSrc}
            alt="Generated"
            referrerPolicy="no-referrer"
            style={{
              maxWidth: "100%",
              height: "auto",
              borderRadius: "8px",
              display: "block",
            }}
            onError={() => {
              setPreviewFailed(true)
            }}
          />
        ) : null}

        {mediaType === "video" && !previewFailed ? (
          <video
            src={mediaSrc}
            controls
            playsInline
            style={{
              maxWidth: "100%",
              borderRadius: "8px",
              display: "block",
            }}
            onError={() => setPreviewFailed(true)}
          />
        ) : null}

        {previewFailed ? (
          <p style={{ ...metaStyle, marginTop: 0 }}>
            Inline preview is blocked by host CSP. Use the button below to open
            the asset.
          </p>
        ) : null}

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button type="button" onClick={handleCopyUrl} style={buttonStyle}>
            {copyState === "success"
              ? `Copied: ${url}`
              : copyState === "error"
                ? "Copy failed"
                : "Copy asset URL"}
          </button>
        </div>
      </div>
    </McpUseProvider>
  )
}

export default GenerationResult
