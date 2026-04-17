import RunwayML, { TaskFailedError } from "@runwayml/sdk"
import {
  getModelById,
  getStrategy,
  resolveModel,
  validateModelInputs,
  type Model,
} from "@runway-playground/shared"
import { MCPServer, text, widget } from "mcp-use/server"
import { z } from "zod"

const server = new MCPServer({
  name: "runway-playground-mcp",
  title: "Runway API Playground",
  version: "0.1.0",
  description: "Generate images and videos with the Runway API via MCP Apps",
  /**
   * Omit when unset so `listen()` can set `serverBaseUrl` from `MCP_URL` or
   * `http://${HOST}:${PORT}` (default PORT in mcp-use is 3000). A hardcoded
   * `http://localhost:3333` here caused widget `<script src>` to target 3333
   * while the process listened elsewhere → ERR_CONNECTION_REFUSED in MCP Use.
   */
  baseUrl: process.env.MCP_URL?.trim() || undefined,
  favicon: "icon.svg",
  websiteUrl: "https://docs.dev.runwayml.com",
  icons: [
    {
      src: "icon.svg",
      mimeType: "image/svg+xml",
      sizes: ["512x512"],
    },
  ],
})

/** Mirrors mcp-use `getServerBaseUrl` (MCPServer#getServerBaseUrl is not public in types). */
function effectiveMcpPublicBaseUrl(): string {
  let url = server.serverBaseUrl?.trim()
  if (!url) {
    const fromEnv = process.env.MCP_URL?.trim()
    if (fromEnv) {
      url = fromEnv
    } else {
      const port = server.serverPort ?? (process.env.PORT ? parseInt(process.env.PORT, 10) : 3000)
      const host = server.serverHost || process.env.HOST?.trim() || "localhost"
      url = `http://${host}:${Number.isNaN(port) ? 3000 : port}`
    }
  }
  return url.replace(/\/\/0\.0\.0\.0(:|\/|$)/, "//localhost$1")
}

function warnIfLocalhostPublicPortMismatchesListenPort(): void {
  const listenPort = server.serverPort
  if (!listenPort) return
  const base = server.serverBaseUrl?.trim() || process.env.MCP_URL?.trim()
  if (!base) return
  try {
    const u = new URL(base)
    if (u.hostname !== "localhost" && u.hostname !== "127.0.0.1") return
    const urlPort = u.port
      ? parseInt(u.port, 10)
      : u.protocol === "https:"
        ? 443
        : 80
    if (Number.isNaN(urlPort) || urlPort === listenPort) return
    console.error(
      `[runway-mcp] MCP_URL / public base (${u.origin}) is port ${urlPort} but this process listens on ${listenPort}. ` +
        `Widget HTML will request ${u.origin}/mcp-use/... and fail with ERR_CONNECTION_REFUSED. ` +
        `Remove MCP_URL from packages/runway-mcp/.env or set MCP_URL=http://localhost:${listenPort} when that origin serves /mcp-use.`,
    )
  } catch {
    /* ignore */
  }
}

function getMcpServerHttpOrigin(): string {
  const raw = effectiveMcpPublicBaseUrl().replace(/\/$/, "")
  if (!raw) return ""
  try {
    const abs =
      /^https?:\/\//i.test(raw)
        ? raw
        : /^(localhost(:\d+)?|127\.0\.0\.1(:\d+)?)/i.test(raw)
          ? `http://${raw}`
          : `https://${raw}`
    const u = new URL(abs)
    if (u.protocol !== "http:" && u.protocol !== "https:") return ""
    return u.origin
  } catch {
    return ""
  }
}

// Mount target must be `widget-root` — mcp-use generated entry.tsx uses getElementById("widget-root").
server.uiResource({
  type: "mcpApps",
  name: "generation-result",
  htmlTemplate: `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Generation result</title>
      </head>
      <body>
        <div id="widget-root"></div>
        <script type="module" src="/resources/generation-result.js"></script>
      </body>
    </html>
  `,
  metadata: {
    csp: {
      connectDomains: [
        "https://api.dev.runwayml.com",
        "https://api.runwayml.com",
        "https://storage.googleapis.com",
        // Runway task artifacts (URLs vary by region / CDN pool)
        "https://*.cloudfront.net",
        "https://dnznrvs05pmza.cloudfront.net",
      ],
      resourceDomains: [
        "https://api.dev.runwayml.com",
        "https://api.runwayml.com",
        "https://storage.googleapis.com",
        "https://media.runwayml.com",
        // Gemini / Gen models often serve images from *.cloudfront.net (not a single hostname)
        "https://*.cloudfront.net",
        // Some clients do not honor wildcard img-src for task artifacts
        "https://dnznrvs05pmza.cloudfront.net",
      ],
    },
    prefersBorder: true,
    invoking: "Generating media…",
    invoked: "Generation complete",
    widgetDescription: "Preview Runway image or video output with open-in-browser.",
  },
})

function inferMediaType(url: string): "image" | "video" {
  if (/\.(mp4|webm|mov)(\?|$)/i.test(url)) return "video"
  return "image"
}

/** Hosts we allow the media proxy to fetch (Runway / common CDNs only). */
function isAllowedArtifactHost(hostname: string): boolean {
  if (hostname === "storage.googleapis.com") return true
  if (hostname === "media.runwayml.com") return true
  if (hostname.endsWith(".cloudfront.net")) return true
  if (hostname.endsWith(".runwayml.com")) return true
  if (hostname.endsWith(".amazonaws.com")) return true
  if (hostname.endsWith(".r2.dev")) return true
  return false
}

/** Small server-inlined previews only; larger images use client fetch → blob URL in the widget. */
const MAX_INLINE_IMAGE_BYTES = 512 * 1024

async function tryFetchImageDataUrl(artifactUrl: string): Promise<
  | { ok: true; dataUrl: string; byteLength: number }
  | { ok: false; reason: string; byteLength?: number }
> {
  let target: URL
  try {
    target = new URL(artifactUrl)
  } catch {
    return { ok: false, reason: "invalid-url" }
  }
  if (target.protocol !== "https:") {
    return { ok: false, reason: "not-https" }
  }
  if (!isAllowedArtifactHost(target.hostname)) {
    return { ok: false, reason: "host-not-allowed" }
  }
  const upstream = await fetch(target.toString(), {
    redirect: "follow",
    headers: { Accept: "*/*" },
  })
  if (!upstream.ok) {
    return { ok: false, reason: `upstream-${upstream.status}` }
  }
  const cl = upstream.headers.get("content-length")
  if (cl) {
    const n = Number.parseInt(cl, 10)
    if (!Number.isNaN(n) && n > MAX_INLINE_IMAGE_BYTES) {
      return { ok: false, reason: "content-length-cap", byteLength: n }
    }
  }
  const buf = new Uint8Array(await upstream.arrayBuffer())
  if (buf.byteLength > MAX_INLINE_IMAGE_BYTES) {
    return { ok: false, reason: "body-cap", byteLength: buf.byteLength }
  }
  const rawCt = upstream.headers.get("content-type") ?? "image/png"
  const mime = rawCt.split(";")[0]?.trim() || "image/png"
  const b64 = Buffer.from(buf).toString("base64")
  return {
    ok: true,
    dataUrl: `data:${mime};base64,${b64}`,
    byteLength: buf.byteLength,
  }
}

/**
 * Same-origin proxy so widget <img>/<video> src stays on the MCP HTTP host.
 * MCP Apps sandboxes often block arbitrary third-party img-src even when metadata lists CDNs.
 */
server.get("/__media-proxy", async (c) => {
  const rawU = c.req.query("u")
  if (!rawU) {
    return c.json({ error: "missing u" }, 400)
  }
  let target: URL
  try {
    target = new URL(decodeURIComponent(rawU))
  } catch {
    return c.json({ error: "invalid url" }, 400)
  }
  if (target.protocol !== "https:") {
    return c.json({ error: "https only" }, 400)
  }
  if (!isAllowedArtifactHost(target.hostname)) {
    return c.json({ error: "host not allowed" }, 403)
  }

  const upstream = await fetch(target.toString(), {
    redirect: "follow",
    headers: { Accept: "*/*" },
  })
  if (!upstream.ok) {
    return c.text(`upstream ${upstream.status}`, 502)
  }
  const ct = upstream.headers.get("content-type") ?? "application/octet-stream"
  return new Response(upstream.body, {
    headers: {
      "content-type": ct,
      "cache-control": "private, max-age=120",
    },
  })
})

const assetSchema = z.object({
  url: z.string().min(1).describe("HTTPS URL to an input image or video"),
  tag: z
    .string()
    .optional()
    .describe('Slot tag when required (e.g. act_two: "character", "reference")'),
  type: z
    .enum(["image", "video"])
    .optional()
    .describe("Input media type; inferred from the URL when omitted"),
})

const generateMediaSchema = z.object({
  promptText: z.string().describe("Prompt text for the generation"),
  model: z
    .string()
    .describe(
      "Model id (e.g. gen4_image_turbo, gen4_turbo, veo3, gen4_aleph, upscale_v1, act_two)",
    ),
  generationType: z
    .enum(["image", "video"])
    .describe("Whether to generate an image or a video"),
  ratio: z
    .string()
    .optional()
    .describe(
      "Aspect ratio; when omitted, the first allowed ratio for the model is used",
    ),
  assets: z
    .array(assetSchema)
    .optional()
    .describe("Reference images, source video, or other inputs as HTTPS URLs"),
})

server.tool(
  {
    name: "generate_media",
    description:
      "Generate an image or video with the Runway API using the same models and validation as the Runway API Playground web app. Requires RUNWAY_API_KEY in the server environment.",
    schema: generateMediaSchema,
    widget: {
      name: "generation-result",
      invoking: "Calling Runway…",
      invoked: "Media ready",
    },
  },
  async (input) => {
    const apiKey = process.env.RUNWAY_API_KEY?.trim()
    if (!apiKey) {
      throw new Error(
        "RUNWAY_API_KEY is not set. Add it to the environment for this MCP server process.",
      )
    }

    let model: Model
    try {
      model = resolveModel(input.model)
    } catch {
      throw new Error(`Unknown model: ${input.model}`)
    }

    const modelDef = getModelById(model)
    const effectiveRatio =
      modelDef.ratios.length > 0
        ? (input.ratio ?? modelDef.ratios[0])
        : (input.ratio ?? "")

    const positionsRequired =
      modelDef.inputs.kind === "standard" && modelDef.inputs.positionsRequired

    const inputs = (input.assets ?? []).map((a) => ({
      type: (a.type ?? inferMediaType(a.url)) as "image" | "video",
      url: a.url,
      tag: a.tag ?? null,
      ...(positionsRequired ? { position: "first" as const } : {}),
    }))

    validateModelInputs(
      model,
      input.generationType,
      input.promptText,
      inputs,
      effectiveRatio,
    )

    const hasAssets = (input.assets?.length ?? 0) > 0
    const endpoint =
      !hasAssets && modelDef.textOnlyEndpoint
        ? modelDef.textOnlyEndpoint
        : modelDef.endpoint

    const strategy = getStrategy(endpoint)
    const strategyAssets = (input.assets ?? []).map((a) => ({
      url: a.url,
      tag: a.tag ?? "",
    }))

    try {
      const client = new RunwayML({ apiKey })
      const result = await strategy.execute({
        client,
        model,
        promptText: input.promptText,
        assets: strategyAssets,
        ratio: effectiveRatio,
        additionalParams: modelDef.additionalParams
          ? Object.fromEntries(
              Object.entries(modelDef.additionalParams).map(([k, v]) => [
                k,
                v.default,
              ]),
            )
          : undefined,
      })

      const ratioLabel = effectiveRatio || "(n/a)"

      const mcpHttpOrigin = getMcpServerHttpOrigin()

      let previewDataUrl: string | undefined
      if (result.mediaType === "image") {
        const inlined = await tryFetchImageDataUrl(result.url)
        if (inlined.ok) {
          previewDataUrl = inlined.dataUrl
        }
      }

      return widget({
        props: {
          url: result.url,
          mediaType: result.mediaType,
          model,
          generationType: input.generationType,
          ratio: effectiveRatio,
          mcpHttpOrigin,
          previewDataUrl,
        },
        output: text(
          `Generated ${result.mediaType} with model ${model} at ratio ${ratioLabel}. Open the widget to preview or open the asset URL.`,
        ),
      })
    } catch (error: unknown) {
      if (error instanceof TaskFailedError) {
        throw new Error(
          `Runway task failed: ${JSON.stringify(error.taskDetails ?? error.message)}`,
        )
      }
      throw error
    }
  },
)

void server.listen().then(() => {
  const publicBase = effectiveMcpPublicBaseUrl()
  warnIfLocalhostPublicPortMismatchesListenPort()
  console.log(`Runway MCP server listening (${publicBase})`)
  console.warn(
    `[runway-mcp] Widget scripts load from ${publicBase.replace(/\/$/, "")} (same as MCP_URL or PORT). If the inspector shows ERR_CONNECTION_REFUSED for /mcp-use/widgets, this origin is wrong or the server is not reachable from the browser.`,
  )
})
