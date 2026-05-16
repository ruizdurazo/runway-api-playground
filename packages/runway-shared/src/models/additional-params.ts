import { MODEL_REGISTRY, resolveModel } from "./registry.js"

function coerceAdditionalParamValues(
  modelId: string,
  merged: Record<string, unknown>,
): void {
  const resolved = resolveModel(modelId)
  const config = MODEL_REGISTRY[resolved]
  if (!config.additionalParams) return
  for (const [key, raw] of Object.entries(merged)) {
    const pc = config.additionalParams[key]
    if (!pc) continue
    if (typeof pc.default === "boolean") {
      if (raw === true || raw === "true") merged[key] = true
      else if (raw === false || raw === "false") merged[key] = false
      continue
    }
    if (typeof pc.default === "number" && typeof raw === "string" && raw.trim() !== "") {
      const n = Number(raw)
      if (!Number.isNaN(n)) merged[key] = n
    }
  }
}

/**
 * Default additional request fields from the model registry (duration, audio, etc.).
 */
export function getDefaultAdditionalParams(
  modelId: string,
): Record<string, unknown> | undefined {
  const resolved = resolveModel(modelId)
  const config = MODEL_REGISTRY[resolved]
  if (!config.additionalParams) return undefined
  return Object.fromEntries(
    Object.entries(config.additionalParams).map(([k, v]) => [k, v.default]),
  )
}

/**
 * Merge registry defaults with client overrides. Drops keys whose value is `undefined`.
 */
export function mergeAdditionalParams(
  modelId: string,
  overrides?: Record<string, unknown> | null,
): Record<string, unknown> | undefined {
  const defaults = getDefaultAdditionalParams(modelId)
  if (!defaults && (!overrides || Object.keys(overrides).length === 0)) {
    return undefined
  }
  const merged: Record<string, unknown> = { ...defaults, ...(overrides ?? {}) }
  for (const key of Object.keys(merged)) {
    if (merged[key] === undefined) delete merged[key]
  }
  coerceAdditionalParamValues(modelId, merged)
  if (Object.keys(merged).length === 0) return undefined
  return merged
}
