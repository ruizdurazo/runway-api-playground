import { existsSync, readFileSync } from "node:fs"
import { basename, dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import RunwayML, { TaskFailedError } from "@runwayml/sdk"
import {
  getModelById,
  getStrategy,
  MODEL_ALIASES,
  MODEL_REGISTRY,
  resolveModel,
  validateModelInputs,
  type Model,
  type ModelDefinition,
} from "@runway-playground/shared"
import { MCPServer, text, widget } from "mcp-use/server"
import { z } from "zod"

/**
 * mcp-use resolves `dist/` and `dist/mcp-use.json` via `process.cwd()` (see `getCwd()` in
 * mcp-use). Manufact/Fly may start Node with cwd ≠ this package (e.g. monorepo root),
 * so widget mount finds no files → no `ui://` resources registered, while we still set
 * `server.buildId` from this file’s location → clients request a URI nothing serves.
 */
function resolveMcpPackagePaths(): { packageRoot: string; distDir: string } {
  const entryDir = dirname(fileURLToPath(import.meta.url))
  const distDir =
    basename(entryDir) === "dist" ? entryDir : join(entryDir, "dist")
  const packageRoot =
    basename(entryDir) === "dist" ? join(entryDir, "..") : entryDir
  return { packageRoot, distDir }
}

function ensureMcpPackageRootForWidgetPaths(): void {
  try {
    process.chdir(resolveMcpPackagePaths().packageRoot)
  } catch {
    /* ignore — cwd may be fixed by the host already */
  }
}

/**
 * mcp-use registers tools before `listen()` mounts widgets. Tool widget metadata
 * uses `server.buildId` for `ui://widget/<name>-<buildId>.html`, while `mcp-use build`
 * writes the same id into `dist/mcp-use.json`. If `buildId` is unset until mount,
 * clients (e.g. Manufact) can see `ui://widget/hello-ui.html` in tool _meta while
 * the server only registered `ui://widget/hello-ui-<hash>.html` → resources/read 404.
 */
function readWidgetBuildIdFromMcpUseManifest(): string | undefined {
  try {
    const manifestPath = join(resolveMcpPackagePaths().distDir, "mcp-use.json")
    if (!existsSync(manifestPath)) return undefined
    const parsed = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      buildId?: unknown
    }
    return typeof parsed.buildId === "string" ? parsed.buildId : undefined
  } catch {
    return undefined
  }
}

ensureMcpPackageRootForWidgetPaths()

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

const widgetBuildId = readWidgetBuildIdFromMcpUseManifest()
if (widgetBuildId) {
  server.buildId = widgetBuildId
}

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

// Widget HTML and script tags come from `mcp-use build` → dist/resources/widgets/generation-result/index.html
// (served under /mcp-use/widgets/...). Do not hand-roll `/resources/*.js` paths — they 404 in MCP Apps embeds.

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

function formatAdditionalParamsForDocs(
  params: NonNullable<ModelDefinition["additionalParams"]>,
): string {
  return Object.entries(params)
    .map(([key, cfg]) => {
      const bits: string[] = [`default ${JSON.stringify(cfg.default)}`]
      if (cfg.options?.length) {
        bits.push(`allowed: ${cfg.options.join(", ")}`)
      }
      if (cfg.min !== undefined || cfg.max !== undefined) {
        bits.push(`min ${cfg.min ?? "—"} max ${cfg.max ?? "—"}`)
      }
      return `${key} (${bits.join("; ")})`
    })
    .join(". ")
}

function formatInputsForDocs(inputs: ModelDefinition["inputs"]): string {
  switch (inputs.kind) {
    case "none":
      return "assets: none."
    case "named": {
      const slots = Object.entries(inputs.slots)
        .map(([name, slot]) => {
          const types = Array.isArray(slot.type)
            ? slot.type.join(" | ")
            : slot.type
          return `${name}: ${types}, ${slot.minCount}–${slot.maxCount} asset(s) with tag "${name}"`
        })
        .join("; ")
      return `assets: ${slots}.`
    }
    case "standard": {
      const max =
        inputs.maxCount === Infinity ? "unlimited" : String(inputs.maxCount)
      let line = `assets: ${inputs.minCount}–${max} × ${inputs.type}`
      if (inputs.additionalReferences) {
        const ar = inputs.additionalReferences
        line += `; optional ${ar.minCount}–${ar.maxCount} extra image(s) for references`
      }
      if (inputs.tagsAllowed) {
        line += "; optional tag 3–16 chars per asset when refs used"
      }
      return `${line}.`
    }
    default:
      return "assets: (see registry)."
  }
}

function sortedModelIds(): Model[] {
  return (Object.keys(MODEL_REGISTRY) as Model[]).slice().sort()
}

function buildGenerateMediaToolDescription(): string {
  const aliasLine =
    Object.keys(MODEL_ALIASES).length === 0
      ? "Model aliases: none."
      : `Model aliases (these ids resolve to the canonical registry key): ${(
          Object.entries(MODEL_ALIASES) as [string, Model][]
        )
          .map(([alias, canonical]) => `${alias} → ${canonical}`)
          .join(", ")}.`

  const perModel = (Object.entries(MODEL_REGISTRY) as [Model, ModelDefinition][])
    .slice()
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, def]) => {
      const genTypes = def.generationTypes.join(", ")
      const promptRule = def.prompt.required
        ? "prompt required"
        : def.prompt.maxLength
          ? `prompt optional (max ${def.prompt.maxLength} chars when set)`
          : "prompt optional"
      const ratios =
        def.ratios.length === 0
          ? "ratios: none for this model (omit ratio)"
          : `ratios: ${def.ratios.join(", ")} — omit ratio to use first listed`
      const inputs = formatInputsForDocs(def.inputs)
      const extras = def.additionalParams
        ? `SDK defaults: ${formatAdditionalParamsForDocs(def.additionalParams)}`
        : ""
      return `• ${id} (${def.displayName}) — generationType: ${genTypes}; ${promptRule}; ${ratios}; ${inputs}${extras ? ` ${extras}` : ""}`
    })
    .join("\n")

  return [
    "Generate an image or video with the Runway API. Model ids, allowed generationType, ratios, and asset rules are defined in the shared MODEL_REGISTRY (listed below).",
    "",
    "Parameters:",
    "- promptText: text prompt; required when the chosen model marks prompt as required.",
    `- model: canonical id — ${sortedModelIds().join(", ")}`,
    aliasLine,
    '- generationType: "image" or "video"; must be one of the types that model supports.',
    "- ratio: optional width:height string; must be one of that model's ratios when the model defines any; if omitted, the first ratio for that model is used.",
    '- assets: optional { url, type?, tag? }[] — HTTPS urls; for act_two set tag to "character" or "reference" per slot; type inferred from URL extension when omitted.',
    "",
    "Per-model options:",
    perModel,
  ].join("\n")
}

const generateMediaToolDescription = buildGenerateMediaToolDescription()

const generateMediaModelFieldDescription = [
  `Canonical model id: ${sortedModelIds().join(", ")}.`,
  Object.keys(MODEL_ALIASES).length
    ? `Aliases: ${(Object.entries(MODEL_ALIASES) as [string, Model][])
        .map(([a, c]) => `${a}→${c}`)
        .join(", ")}.`
    : "",
  "Must match generationType and other constraints in the tool description.",
]
  .filter(Boolean)
  .join(" ")

const assetSchema = z.object({
  url: z.string().min(1).describe("HTTPS URL to an input image or video"),
  tag: z
    .string()
    .optional()
    .describe(
      'Optional slot tag: required for act_two assets — "character" or "reference". Optional 3–16 char tag on reference images when the model allows tags.',
    ),
  type: z
    .enum(["image", "video"])
    .optional()
    .describe("Input media type; inferred from the URL when omitted"),
})

const generateMediaSchema = z.object({
  promptText: z
    .string()
    .describe(
      "Text prompt; required for models that require a prompt (see tool description). Respects each model's max length when set.",
    ),
  model: z.string().describe(generateMediaModelFieldDescription),
  generationType: z
    .enum(["image", "video"])
    .describe(
      'Must be "image" or "video" and must be allowed for the chosen model (each model lists supported generationType values in the tool description).',
    ),
  ratio: z
    .string()
    .optional()
    .describe(
      "Aspect ratio W:H; must be one of the ratios listed for that model in the tool description when the model has ratios. When omitted, the first ratio for the model is used.",
    ),
  assets: z
    .array(assetSchema)
    .optional()
    .describe(
      "Reference images, source video, or character/reference media as HTTPS URLs; min/max counts and tags depend on the model (see tool description).",
    ),
})

const helloUiSchema = z.object({
  label: z
    .string()
    .optional()
    .describe("Optional text shown inside the yellow panel."),
})

server.tool(
  {
    name: "hello_ui",
    description:
      "MCP Apps smoke test only: shows a yellow hello panel with a counter button (does not call Runway). Use to verify widget UI loads in Claude.",
    schema: helloUiSchema,
    widget: {
      name: "hello-ui",
      invoking: "Loading hello UI…",
      invoked: "Hello UI ready",
    },
  },
  async (input) =>
    widget({
      props: { label: input.label },
      output: text(
        "Hello UI widget attached. If MCP Apps embedding works, you should see a yellow panel above.",
      ),
    }),
)

server.tool(
  {
    name: "generate_media",
    description: generateMediaToolDescription,
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
