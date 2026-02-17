import { MODEL_REGISTRY, resolveModel } from "./registry"
import type { StandardInputConfig, NamedInputConfig } from "./types"

export interface ValidationInput {
  type: "image" | "video"
  tag?: string | null
  position?: "first" | "last"
  file?: File
  url?: string
}

/**
 * Validates model inputs against the model's configuration.
 * Throws descriptive errors on invalid combinations.
 */
export function validateModelInputs(
  modelId: string,
  generationType: "image" | "video",
  promptText: string,
  inputs: ValidationInput[],
  ratio: string,
  additionalParams?: Record<string, unknown>,
): void {
  const resolved = resolveModel(modelId)
  const config = MODEL_REGISTRY[resolved]

  // Generation type
  if (!config.generationTypes.includes(generationType)) {
    throw new Error(
      `Generation type "${generationType}" is not allowed for ${config.displayName}`,
    )
  }

  // Prompt text
  if (config.prompt.required && !promptText) {
    throw new Error(`Prompt text is required for ${config.displayName}`)
  }
  if (
    promptText &&
    config.prompt.maxLength &&
    promptText.length > config.prompt.maxLength
  ) {
    throw new Error(
      `Prompt text exceeds max length (${config.prompt.maxLength}) for ${config.displayName}`,
    )
  }

  // Ratio (fixed: no longer shadows the outer `ratio` variable)
  if (config.ratios.length > 0 && !config.ratios.some((r) => r === ratio)) {
    throw new Error(
      `Invalid ratio "${ratio}" for ${config.displayName}`,
    )
  }

  // Input validation
  validateInputs(config.inputs, inputs, config.displayName)

  // Additional params
  if (additionalParams && config.additionalParams) {
    for (const [key, value] of Object.entries(additionalParams)) {
      const paramConfig = config.additionalParams[key]
      if (!paramConfig) continue

      if (paramConfig.options && !paramConfig.options.includes(value as number)) {
        throw new Error(
          `Invalid value for "${key}" in ${config.displayName}. Allowed: ${paramConfig.options.join(", ")}`,
        )
      }
      if (paramConfig.min !== undefined && (value as number) < paramConfig.min) {
        throw new Error(
          `"${key}" must be at least ${paramConfig.min} for ${config.displayName}`,
        )
      }
      if (paramConfig.max !== undefined && (value as number) > paramConfig.max) {
        throw new Error(
          `"${key}" must be at most ${paramConfig.max} for ${config.displayName}`,
        )
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function validateInputs(
  inputConfig: typeof MODEL_REGISTRY[keyof typeof MODEL_REGISTRY]["inputs"],
  inputs: ValidationInput[],
  modelName: string,
): void {
  switch (inputConfig.kind) {
    case "none":
      // No file inputs expected
      break

    case "standard":
      validateStandardInputs(inputConfig, inputs, modelName)
      break

    case "named":
      validateNamedInputs(inputConfig, inputs, modelName)
      break
  }
}

function validateStandardInputs(
  config: StandardInputConfig,
  inputs: ValidationInput[],
  modelName: string,
): void {
  const count = inputs.length

  if (count < config.minCount || count > config.maxCount) {
    const max = config.maxCount === Infinity ? "unlimited" : config.maxCount
    throw new Error(
      `${modelName} requires between ${config.minCount} and ${max} inputs (got ${count})`,
    )
  }

  for (const [i, input] of inputs.entries()) {
    if (!input.type) {
      throw new Error(`Input ${i + 1} is missing a type`)
    }
    if (input.type !== config.type) {
      throw new Error(
        `Input ${i + 1} must be ${config.type} for ${modelName}`,
      )
    }
    if (input.tag && !config.tagsAllowed) {
      throw new Error(`Tags are not allowed for ${modelName}`)
    }
    if (config.positionsRequired && !input.position) {
      throw new Error(
        `Position is required for input ${i + 1} in ${modelName}`,
      )
    }
    if (config.allowedFileTypes && input.file) {
      const allowed = config.allowedFileTypes.some((pattern) =>
        input.file!.type.match(pattern.replace("*", ".*")),
      )
      if (!allowed) {
        throw new Error(
          `Invalid file type for input ${i + 1} in ${modelName}`,
        )
      }
    }
  }
}

function validateNamedInputs(
  config: NamedInputConfig,
  inputs: ValidationInput[],
  modelName: string,
): void {
  for (const [slotName, slotConfig] of Object.entries(config.slots)) {
    const slotInputs = inputs.filter((i) => i.tag === slotName)

    if (slotInputs.length < slotConfig.minCount) {
      throw new Error(
        `${modelName} requires at least ${slotConfig.minCount} "${slotName}" input(s)`,
      )
    }
    if (slotInputs.length > slotConfig.maxCount) {
      throw new Error(
        `${modelName} allows at most ${slotConfig.maxCount} "${slotName}" input(s)`,
      )
    }

    for (const input of slotInputs) {
      const allowedTypes = Array.isArray(slotConfig.type)
        ? slotConfig.type
        : [slotConfig.type]
      if (!allowedTypes.includes(input.type)) {
        throw new Error(
          `"${slotName}" input must be ${allowedTypes.join(" or ")} for ${modelName}`,
        )
      }
    }
  }
}
