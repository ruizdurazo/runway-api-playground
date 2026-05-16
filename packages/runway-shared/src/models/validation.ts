import { MODEL_REGISTRY, resolveModel } from "./registry.js"
import type { StandardInputConfig, NamedInputConfig } from "./types.js"

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
  options?: { usingTextOnlyEndpoint?: boolean },
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

  const ratioList =
    options?.usingTextOnlyEndpoint &&
    config.textOnlyRatios &&
    config.textOnlyRatios.length > 0
      ? config.textOnlyRatios
      : config.ratios

  // Ratio
  if (ratioList.length > 0 && !ratioList.some((r) => r === ratio)) {
    throw new Error(
      `Invalid ratio "${ratio}" for ${config.displayName}`,
    )
  }

  // Input validation
  validateInputs(
    config.inputs,
    inputs,
    config.displayName,
    config.supportsLastFrame === true,
  )

  // Additional params
  if (additionalParams && config.additionalParams) {
    for (const [key, value] of Object.entries(additionalParams)) {
      const paramConfig = config.additionalParams[key]
      if (!paramConfig) continue

      if (typeof paramConfig.default === "boolean") {
        if (typeof value !== "boolean") {
          throw new Error(`"${key}" must be a boolean for ${config.displayName}`)
        }
        continue
      }

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
  supportsLastFrame: boolean,
): void {
  switch (inputConfig.kind) {
    case "none":
      // No file inputs expected
      break

    case "standard":
      validateStandardInputs(inputConfig, inputs, modelName, supportsLastFrame)
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
  supportsLastFrame: boolean,
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
    if (config.tagsAllowed && input.tag && (input.tag.length < 3 || input.tag.length > 16)) {
      throw new Error(
        `Tag "${input.tag}" on input ${i + 1} must be 3–16 characters`,
      )
    }
    if (config.positionsRequired && !input.position) {
      throw new Error(
        `Position is required for input ${i + 1} in ${modelName}`,
      )
    }
    if (config.positionsRequired && input.position === "last" && !supportsLastFrame) {
      throw new Error(
        `Position "last" is not supported for ${modelName}`,
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

  if (config.positionsRequired && supportsLastFrame) {
    const positions = inputs.map((i) => i.position)
    const first = positions.filter((p) => p === "first").length
    const last = positions.filter((p) => p === "last").length
    if (first > 1) {
      throw new Error(`At most one "first" frame is allowed for ${modelName}`)
    }
    if (last > 1) {
      throw new Error(`At most one "last" frame is allowed for ${modelName}`)
    }
    if (count === 1 && positions[0] === "last") {
      throw new Error(
        `A single image must use the "first" position for ${modelName}`,
      )
    }
    if (count === 2 && (first !== 1 || last !== 1)) {
      throw new Error(
        `Two images require exactly one "first" and one "last" position for ${modelName}`,
      )
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
