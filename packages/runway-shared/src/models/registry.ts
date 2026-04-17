import type { ModelDefinition, GenerationType } from "./types"

// ---------------------------------------------------------------------------
// Helper to type-check each model while preserving object key literals
// ---------------------------------------------------------------------------

function defineModel(model: ModelDefinition): ModelDefinition {
  return model
}

// ---------------------------------------------------------------------------
// Model registry -- single source of truth
// ---------------------------------------------------------------------------

export const MODEL_REGISTRY = {
  // ---- Video: Image to Video ------------------------------------------------

  gen4_turbo: defineModel({
    displayName: "Gen-4 Turbo",
    endpoint: "image_to_video",
    category: "video",
    creditsPerUnit: 5,
    creditUnit: "second",
    generationTypes: ["video"],
    prompt: { required: false, maxLength: 1000 },
    inputs: {
      kind: "standard",
      type: "image",
      minCount: 1,
      maxCount: Infinity,
      tagsAllowed: false,
      positionsRequired: true,
      allowedFileTypes: ["image/*"],
    },
    ratios: [
      "1280:720",
      "720:1280",
      "1104:832",
      "832:1104",
      "960:960",
      "1584:672",
    ],
    additionalParams: { duration: { default: 10, options: [5, 10] } },
  }),

  gen3a_turbo: defineModel({
    displayName: "Gen-3a Turbo",
    endpoint: "image_to_video",
    category: "video",
    creditsPerUnit: 5,
    creditUnit: "second",
    generationTypes: ["video"],
    prompt: { required: false, maxLength: 1000 },
    inputs: {
      kind: "standard",
      type: "image",
      minCount: 1,
      maxCount: Infinity,
      tagsAllowed: false,
      positionsRequired: true,
      allowedFileTypes: ["image/*"],
    },
    ratios: ["1280:768", "768:1280"],
    additionalParams: { duration: { default: 10, options: [5, 10] } },
  }),

  "gen4.5": defineModel({
    displayName: "Gen-4.5",
    endpoint: "image_to_video",
    textOnlyEndpoint: "text_to_video",
    category: "video",
    creditsPerUnit: 12,
    creditUnit: "second",
    generationTypes: ["video"],
    prompt: { required: true, maxLength: 1000 },
    inputs: {
      kind: "standard",
      type: "image",
      minCount: 0,
      maxCount: Infinity,
      tagsAllowed: false,
      positionsRequired: true,
      allowedFileTypes: ["image/*"],
    },
    ratios: [
      "1280:720",
      "720:1280",
      "1104:832",
      "832:1104",
      "960:960",
      "1584:672",
      "672:1584",
    ],
    additionalParams: { duration: { default: 10, options: [5, 10] } },
  }),

  veo3: defineModel({
    displayName: "Veo 3",
    endpoint: "image_to_video",
    textOnlyEndpoint: "text_to_video",
    category: "video",
    creditsPerUnit: 40,
    creditUnit: "second",
    generationTypes: ["video"],
    prompt: { required: false, maxLength: 1000 },
    inputs: {
      kind: "standard",
      type: "image",
      minCount: 0,
      maxCount: Infinity,
      tagsAllowed: false,
      positionsRequired: true,
      allowedFileTypes: ["image/*"],
    },
    ratios: ["1280:720", "720:1280"],
    additionalParams: { duration: { default: 8, options: [8] } },
  }),

  "veo3.1": defineModel({
    displayName: "Veo 3.1",
    endpoint: "image_to_video",
    textOnlyEndpoint: "text_to_video",
    category: "video",
    creditsPerUnit: 40,
    creditUnit: "second",
    generationTypes: ["video"],
    prompt: { required: false, maxLength: 1000 },
    inputs: {
      kind: "standard",
      type: "image",
      minCount: 0,
      maxCount: Infinity,
      tagsAllowed: false,
      positionsRequired: true,
      allowedFileTypes: ["image/*"],
    },
    ratios: ["1280:720", "720:1280"],
    additionalParams: { duration: { default: 8, options: [8] } },
  }),

  "veo3.1_fast": defineModel({
    displayName: "Veo 3.1 Fast",
    endpoint: "image_to_video",
    textOnlyEndpoint: "text_to_video",
    category: "video",
    creditsPerUnit: 15,
    creditUnit: "second",
    generationTypes: ["video"],
    prompt: { required: false, maxLength: 1000 },
    inputs: {
      kind: "standard",
      type: "image",
      minCount: 0,
      maxCount: Infinity,
      tagsAllowed: false,
      positionsRequired: true,
      allowedFileTypes: ["image/*"],
    },
    ratios: ["1280:720", "720:1280"],
    additionalParams: { duration: { default: 8, options: [8] } },
  }),

  // ---- Video: Special endpoints ---------------------------------------------

  gen4_aleph: defineModel({
    displayName: "Gen-4 Aleph",
    endpoint: "video_to_video",
    category: "video",
    creditsPerUnit: 15,
    creditUnit: "second",
    generationTypes: ["video"],
    prompt: { required: true, maxLength: 1000 },
    inputs: {
      kind: "standard",
      type: "video",
      minCount: 1,
      maxCount: 1,
      tagsAllowed: false,
      positionsRequired: false,
      allowedFileTypes: ["video/*"],
      additionalReferences: {
        type: "image",
        minCount: 0,
        maxCount: 1,
        tagsAllowed: false,
        allowedFileTypes: ["image/*"],
      },
    },
    ratios: [
      "1280:720",
      "720:1280",
      "1104:832",
      "960:960",
      "832:1104",
      "1584:672",
      "848:480",
      "640:480",
    ],
  }),

  act_two: defineModel({
    displayName: "Act-Two",
    endpoint: "character_performance",
    category: "video",
    creditsPerUnit: 5,
    creditUnit: "second",
    generationTypes: ["video"],
    prompt: { required: false },
    inputs: {
      kind: "named",
      slots: {
        character: {
          type: ["image", "video"],
          minCount: 1,
          maxCount: 1,
          allowedFileTypes: ["image/*", "video/*"],
        },
        reference: {
          type: "video",
          minCount: 1,
          maxCount: 1,
          allowedFileTypes: ["video/*"],
        },
      },
    },
    ratios: [
      "1280:720",
      "720:1280",
      "960:960",
      "1104:832",
      "832:1104",
      "1584:672",
    ],
    additionalParams: {
      bodyControl: { default: true },
      expressionIntensity: { default: 3, min: 1, max: 5 },
    },
  }),

  upscale_v1: defineModel({
    displayName: "Upscale V1",
    endpoint: "video_upscale",
    category: "upscale",
    creditsPerUnit: 5,
    creditUnit: "second",
    generationTypes: ["video"],
    prompt: { required: false },
    inputs: {
      kind: "standard",
      type: "video",
      minCount: 1,
      maxCount: 1,
      tagsAllowed: false,
      positionsRequired: false,
      allowedFileTypes: ["video/*"],
    },
    ratios: [],
  }),

  // ---- Image: Text to Image ------------------------------------------------

  gen4_image_turbo: defineModel({
    displayName: "Gen-4 Image Turbo",
    endpoint: "text_to_image",
    category: "image",
    creditsPerUnit: 2,
    creditUnit: "image",
    generationTypes: ["image"],
    prompt: { required: true, maxLength: 1000 },
    inputs: {
      kind: "standard",
      type: "image",
      minCount: 1,
      maxCount: 3,
      tagsAllowed: true,
      positionsRequired: false,
      allowedFileTypes: ["image/*"],
    },
    ratios: [
      "1920:1080",
      "1080:1920",
      "1024:1024",
      "1360:768",
      "1080:1080",
      "1168:880",
      "1440:1080",
      "1080:1440",
      "1808:768",
      "2112:912",
      "1280:720",
      "720:1280",
      "720:720",
      "960:720",
      "720:960",
      "1680:720",
    ],
  }),

  gen4_image: defineModel({
    displayName: "Gen-4 Image",
    endpoint: "text_to_image",
    category: "image",
    creditsPerUnit: 5,
    creditUnit: "image",
    generationTypes: ["image"],
    prompt: { required: true, maxLength: 1000 },
    inputs: {
      kind: "standard",
      type: "image",
      minCount: 0,
      maxCount: 3,
      tagsAllowed: true,
      positionsRequired: false,
      allowedFileTypes: ["image/*"],
    },
    ratios: [
      "1920:1080",
      "1080:1920",
      "1024:1024",
      "1360:768",
      "1080:1080",
      "1168:880",
      "1440:1080",
      "1080:1440",
      "1808:768",
      "2112:912",
      "1280:720",
      "720:1280",
      "720:720",
      "960:720",
      "720:960",
      "1680:720",
    ],
  }),

  "gemini_2.5_flash": defineModel({
    displayName: "Gemini 2.5 Flash",
    endpoint: "text_to_image",
    category: "image",
    creditsPerUnit: 5,
    creditUnit: "image",
    generationTypes: ["image"],
    prompt: { required: true, maxLength: 1000 },
    inputs: {
      kind: "standard",
      type: "image",
      minCount: 0,
      maxCount: 3,
      tagsAllowed: true,
      positionsRequired: false,
      allowedFileTypes: ["image/*"],
    },
    ratios: [
      "1344:768",
      "768:1344",
      "1024:1024",
      "1184:864",
      "864:1184",
      "1536:672",
    ],
  }),
}

/** Union of all valid model IDs. */
export type Model = keyof typeof MODEL_REGISTRY

// ---------------------------------------------------------------------------
// Legacy aliases -- map old DB model names to current registry keys
// ---------------------------------------------------------------------------

export const MODEL_ALIASES: Partial<Record<string, Model>> = {
  veo3_text: "veo3",
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

export function getModelById(model: Model): ModelDefinition {
  return MODEL_REGISTRY[model]
}

export function resolveModel(model: string): Model {
  if (model in MODEL_REGISTRY) return model as Model
  if (model in MODEL_ALIASES) return MODEL_ALIASES[model]!
  throw new Error(`Unknown model: ${model}`)
}

export function isValidModel(model: string): model is Model {
  return model in MODEL_REGISTRY || model in MODEL_ALIASES
}

export function getModelDisplayName(model: string): string {
  if (model in MODEL_REGISTRY) {
    return MODEL_REGISTRY[model as Model].displayName
  }
  if (model in MODEL_ALIASES) {
    return MODEL_REGISTRY[MODEL_ALIASES[model]!].displayName
  }
  return model
}

export function getModelsByGenerationType(
  type: GenerationType,
): { id: Model; definition: ModelDefinition }[] {
  return (Object.entries(MODEL_REGISTRY) as [Model, ModelDefinition][]).filter(
    ([, def]) => def.generationTypes.includes(type),
  )
    .map(([id, definition]) => ({ id, definition }))
}

export function getModelsByCategory(
  category: ModelDefinition["category"],
): { id: Model; definition: ModelDefinition }[] {
  return (Object.entries(MODEL_REGISTRY) as [Model, ModelDefinition][]).filter(
    ([, def]) => def.category === category,
  )
    .map(([id, definition]) => ({ id, definition }))
}

export function getAllModels(): Model[] {
  return Object.keys(MODEL_REGISTRY) as Model[]
}
