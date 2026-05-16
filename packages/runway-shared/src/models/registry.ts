import type { ModelDefinition, GenerationType } from "./types.js"

// ---------------------------------------------------------------------------
// Helper to type-check each model while preserving object key literals
// ---------------------------------------------------------------------------

function defineModel(model: ModelDefinition): ModelDefinition {
  return model
}

const DURATION_2_TO_10 = [
  2, 3, 4, 5, 6, 7, 8, 9, 10,
] as const satisfies readonly number[]

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
      minCount: 0,
      maxCount: 1,
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
    additionalParams: {
      duration: { default: 10, options: [...DURATION_2_TO_10] },
    },
  }),

  gen3a_turbo: defineModel({
    displayName: "Gen-3a Turbo",
    endpoint: "image_to_video",
    category: "video",
    creditsPerUnit: 5,
    creditUnit: "second",
    generationTypes: ["video"],
    prompt: { required: true, maxLength: 1000 },
    inputs: {
      kind: "standard",
      type: "image",
      minCount: 1,
      maxCount: 2,
      tagsAllowed: false,
      positionsRequired: true,
      allowedFileTypes: ["image/*"],
    },
    ratios: ["1280:768", "768:1280"],
    additionalParams: { duration: { default: 10, options: [5, 10] } },
    supportsLastFrame: true,
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
      maxCount: 1,
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
    textOnlyRatios: ["1280:720", "720:1280"],
    additionalParams: {
      duration: { default: 8, options: [...DURATION_2_TO_10] },
    },
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
      maxCount: 1,
      tagsAllowed: false,
      positionsRequired: true,
      allowedFileTypes: ["image/*"],
    },
    ratios: ["1280:720", "720:1280", "1080:1920", "1920:1080"],
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
      maxCount: 2,
      tagsAllowed: false,
      positionsRequired: true,
      allowedFileTypes: ["image/*"],
    },
    ratios: ["1280:720", "720:1280", "1080:1920", "1920:1080"],
    additionalParams: {
      duration: { default: 8, options: [4, 6, 8] },
      audio: { default: true },
    },
    supportsLastFrame: true,
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
      maxCount: 2,
      tagsAllowed: false,
      positionsRequired: true,
      allowedFileTypes: ["image/*"],
    },
    ratios: ["1280:720", "720:1280", "1080:1920", "1920:1080"],
    additionalParams: {
      duration: { default: 8, options: [4, 6, 8] },
      audio: { default: true },
    },
    supportsLastFrame: true,
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

  gpt_image_2: defineModel({
    displayName: "GPT Image 2",
    endpoint: "text_to_image",
    category: "image",
    creditsPerUnit: 20,
    creditUnit: "image",
    generationTypes: ["image"],
    prompt: { required: true, maxLength: 32000 },
    inputs: {
      kind: "standard",
      type: "image",
      minCount: 0,
      maxCount: 16,
      tagsAllowed: true,
      positionsRequired: false,
      allowedFileTypes: ["image/*"],
    },
    ratios: [
      "2048:880",
      "1920:1088",
      "1920:1280",
      "1920:1440",
      "1920:1536",
      "1920:1920",
      "1536:1920",
      "1440:1920",
      "1280:1920",
      "1088:1920",
      "2912:1248",
      "2560:1440",
      "2560:1712",
      "2560:1920",
      "2560:2048",
      "2560:2560",
      "2048:2560",
      "1920:2560",
      "1712:2560",
      "1440:2560",
      "3840:1648",
      "3840:2160",
      "3504:2336",
      "3264:2448",
      "3200:2560",
      "2880:2880",
      "2560:3200",
      "2448:3264",
      "2336:3504",
      "2160:3840",
      "auto",
    ],
  }),

  gemini_image3_pro: defineModel({
    displayName: "Gemini Image 3 Pro",
    endpoint: "text_to_image",
    category: "image",
    creditsPerUnit: 20,
    creditUnit: "image",
    generationTypes: ["image"],
    prompt: { required: true, maxLength: 5500 },
    inputs: {
      kind: "standard",
      type: "image",
      minCount: 0,
      maxCount: 14,
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
      "832:1248",
      "1248:832",
      "896:1152",
      "1152:896",
      "2048:2048",
      "1696:2528",
      "2528:1696",
      "1792:2400",
      "2400:1792",
      "1856:2304",
      "2304:1856",
      "1536:2752",
      "2752:1536",
      "3168:1344",
      "4096:4096",
      "3392:5056",
      "5056:3392",
      "3584:4800",
      "4800:3584",
      "3712:4608",
      "4608:3712",
      "3072:5504",
      "5504:3072",
      "6336:2688",
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
      "832:1248",
      "1248:832",
      "896:1152",
      "1152:896",
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
  /** Legacy / preview id — not in public text_to_image enum; map to closest Gemini image model. */
  "gemini_image3.1_flash": "gemini_2.5_flash",
  gemini_image3_1_flash: "gemini_2.5_flash",
}

/**
 * Billing / usage API keys that are not in {@link MODEL_REGISTRY} but should show a
 * readable name in dashboards (e.g. settings usage charts).
 */
const RUNWAY_USAGE_MODEL_LABELS: Record<string, string> = {
  gemini_image3_1_flash: "Gemini Image 3.1 Flash",
  "gemini_image3.1_flash": "Gemini Image 3.1 Flash",
  gwm1_avatar_async_audio_to_video: "GWM-1 Avatar (audio to video)",
  gwm1_avatar_async_text_to_video: "GWM-1 Avatar (text to video)",
  gwm1_avatars: "GWM-1 Avatars",
  seedance2: "Seedance 2",
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
  if (model in RUNWAY_USAGE_MODEL_LABELS) {
    return RUNWAY_USAGE_MODEL_LABELS[model]!
  }
  return model
}

export function getModelsByGenerationType(
  type: GenerationType,
): { id: Model; definition: ModelDefinition }[] {
  return (Object.entries(MODEL_REGISTRY) as [Model, ModelDefinition][]).filter(
    ([, def]) => def.generationTypes.includes(type),
  ).map(([id, definition]) => ({ id, definition }))
}

export function getModelsByCategory(
  category: ModelDefinition["category"],
): { id: Model; definition: ModelDefinition }[] {
  return (Object.entries(MODEL_REGISTRY) as [Model, ModelDefinition][]).filter(
    ([, def]) => def.category === category,
  ).map(([id, definition]) => ({ id, definition }))
}

export function getAllModels(): Model[] {
  return Object.keys(MODEL_REGISTRY) as Model[]
}
