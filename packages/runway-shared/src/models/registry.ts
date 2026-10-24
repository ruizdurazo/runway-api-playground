import type { EndpointType, ModelDefinition, GenerationType } from "./types.js"

// ---------------------------------------------------------------------------
// Helper to type-check each model while preserving object key literals
// ---------------------------------------------------------------------------

function defineModel(model: ModelDefinition): ModelDefinition {
  return model
}

function seedanceModel(options: {
  displayName: string
  creditsPerUnit: number
  promptMaxLength: number
  durationMax: number
  ratios: readonly string[]
  maxImages: number
  maxVideos: number
  withMode?: boolean
}): ModelDefinition {
  return defineModel({
    displayName: options.displayName,
    endpoint: "image_to_video",
    textOnlyEndpoint: "text_to_video",
    videoEndpoint: "video_to_video",
    videoProfile: "seedance",
    category: "video",
    creditsPerUnit: options.creditsPerUnit,
    creditUnit: "second",
    generationTypes: ["video"],
    prompt: {
      required: false,
      requiredWithoutInputs: true,
      maxLength: options.promptMaxLength,
    },
    inputs: {
      kind: "standard",
      type: "media",
      minCount: 0,
      maxCount: options.maxImages + options.maxVideos,
      maxImages: options.maxImages,
      maxVideos: options.maxVideos,
      tagsAllowed: false,
      positionsRequired: false,
      flexibleImageRole: true,
      allowedFileTypes: ["image/*", "video/*"],
    },
    ratios: options.ratios,
    supportsLastFrame: true,
    additionalParams: {
      duration: { default: 5, min: 4, max: options.durationMax, allowAuto: true },
      audio: { default: true },
      ...(options.withMode
        ? { mode: { default: "reference", options: ["reference", "extend", "edit"] } }
        : {}),
    },
  })
}

const DURATION_2_TO_10 = [
  2, 3, 4, 5, 6, 7, 8, 9, 10,
] as const satisfies readonly number[]

const SEEDANCE_25_RATIOS = [
  "1280:720",
  "720:1280",
  "1920:1080",
  "1080:1920",
  "960:960",
  "1440:1440",
  "1112:834",
  "834:1112",
  "1664:1248",
  "1248:1664",
  "1470:630",
  "2206:946",
  "992:432",
  "854:480",
  "752:560",
  "640:640",
  "560:752",
  "480:854",
] as const

const SEEDANCE_2_RATIOS = [
  "1280:720",
  "720:1280",
  "1920:1080",
  "1080:1920",
  "960:960",
  "1440:1440",
  "1112:834",
  "834:1112",
  "1664:1248",
  "1248:1664",
  "1470:630",
  "2206:946",
  "992:432",
  "864:496",
  "752:560",
  "640:640",
  "560:752",
  "496:864",
  "3840:2160",
  "2160:3840",
  "3840:1646",
  "3840:2880",
  "3840:3840",
  "2880:3840",
] as const

const SEEDANCE_2_FAST_RATIOS = [
  "1280:720",
  "720:1280",
  "960:960",
  "1112:834",
  "834:1112",
  "1470:630",
  "992:432",
  "864:496",
  "752:560",
  "640:640",
  "560:752",
  "496:864",
] as const

const WAN_RATIOS = [
  "1280:720",
  "720:1280",
  "1920:1080",
  "1080:1920",
  "960:960",
  "1440:1440",
  "1104:832",
  "832:1104",
  "1648:1248",
  "1248:1648",
  "832:480",
  "480:832",
  "720:544",
  "544:720",
  "624:624",
  "auto_720p",
  "auto_1080p",
  "auto_480p",
] as const

const GPT_IMAGE_RATIOS = [
  "1920:1080",
  "1080:1920",
  "1920:1920",
  "2560:1440",
  "1440:2560",
  "2560:2560",
  "3840:2160",
  "2160:3840",
  "2880:2880",
  "auto",
  "2048:880",
  "1920:1088",
  "1920:1280",
  "1920:1440",
  "1920:1536",
  "1536:1920",
  "1440:1920",
  "1280:1920",
  "1088:1920",
  "2912:1248",
  "2560:1712",
  "2560:1920",
  "2560:2048",
  "2048:2560",
  "1920:2560",
  "1712:2560",
  "1440:2560",
  "3840:1648",
  "3504:2336",
  "3264:2448",
  "3200:2560",
  "2560:3200",
  "2448:3264",
  "2336:3504",
] as const

const GEMINI_31_FLASH_RATIOS = [
  "1024:1024",
  "1344:768",
  "768:1344",
  "1184:864",
  "864:1184",
  "1248:832",
  "832:1248",
  "1152:896",
  "896:1152",
  "1536:672",
  "2048:2048",
  "2528:1696",
  "1696:2528",
  "2400:1792",
  "1792:2400",
  "2304:1856",
  "1856:2304",
  "2752:1536",
  "1536:2752",
  "3168:1344",
  "4096:4096",
  "5056:3392",
  "3392:5056",
  "4800:3584",
  "3584:4800",
  "4608:3712",
  "3712:4608",
  "5504:3072",
  "3072:5504",
  "6336:2688",
  "512:512",
  "624:416",
  "416:624",
  "592:432",
  "432:592",
  "576:448",
  "448:576",
  "672:384",
  "384:672",
  "768:336",
  "1024:256",
  "256:1024",
  "1408:176",
  "176:1408",
  "2048:512",
  "512:2048",
  "2816:352",
  "352:2816",
  "4096:1024",
  "1024:4096",
  "5632:704",
  "704:5632",
  "8192:2048",
  "2048:8192",
  "11264:1408",
  "1408:11264",
] as const

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
    listed: false,
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
    listed: false,
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

  seedance2_5: seedanceModel({
    displayName: "Seedance 2.5",
    creditsPerUnit: 30,
    promptMaxLength: 15000,
    durationMax: 30,
    ratios: SEEDANCE_25_RATIOS,
    maxImages: 30,
    maxVideos: 10,
    withMode: true,
  }),

  seedance2: seedanceModel({
    displayName: "Seedance 2.0",
    creditsPerUnit: 36,
    promptMaxLength: 3500,
    durationMax: 15,
    ratios: SEEDANCE_2_RATIOS,
    maxImages: 9,
    maxVideos: 3,
  }),

  seedance2_fast: seedanceModel({
    displayName: "Seedance 2.0 Fast",
    creditsPerUnit: 29,
    promptMaxLength: 3500,
    durationMax: 15,
    ratios: SEEDANCE_2_FAST_RATIOS,
    maxImages: 9,
    maxVideos: 3,
  }),

  seedance2_mini: seedanceModel({
    displayName: "Seedance 2.0 Mini",
    creditsPerUnit: 16,
    promptMaxLength: 3500,
    durationMax: 15,
    ratios: SEEDANCE_2_FAST_RATIOS,
    maxImages: 9,
    maxVideos: 3,
  }),

  wan3: defineModel({
    displayName: "WAN 3.0",
    endpoint: "image_to_video",
    textOnlyEndpoint: "text_to_video",
    videoProfile: "wan",
    category: "video",
    creditsPerUnit: 10,
    creditUnit: "second",
    generationTypes: ["video"],
    prompt: { required: true, maxLength: 20000 },
    inputs: {
      kind: "standard",
      type: "media",
      minCount: 0,
      maxCount: 15,
      maxImages: 10,
      maxVideos: 5,
      tagsAllowed: false,
      positionsRequired: false,
      flexibleImageRole: true,
      allowedFileTypes: ["image/*", "video/*"],
    },
    ratios: WAN_RATIOS,
    keyframeRatios: ["auto_480p", "auto_720p", "auto_1080p"],
    supportsLastFrame: true,
    additionalParams: {
      duration: { default: 5, min: 2, max: 30 },
      audio: { default: true },
    },
  }),

  hailuo3: defineModel({
    displayName: "Hailuo 3.0",
    endpoint: "image_to_video",
    textOnlyEndpoint: "text_to_video",
    videoEndpoint: "video_to_video",
    videoProfile: "hailuo",
    category: "video",
    creditsPerUnit: 10,
    creditUnit: "second",
    generationTypes: ["video"],
    prompt: { required: true, maxLength: 6000 },
    inputs: {
      kind: "standard",
      type: "media",
      minCount: 0,
      maxCount: 12,
      maxImages: 9,
      maxVideos: 3,
      tagsAllowed: false,
      positionsRequired: false,
      flexibleImageRole: true,
      allowedFileTypes: ["image/*", "video/*"],
    },
    ratios: ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"],
    supportsLastFrame: true,
    additionalParams: {
      duration: { default: 6, min: 5, max: 15 },
      resolution: { default: "768p", options: ["768p", "2k"] },
    },
  }),

  grok_imagine_1_5: defineModel({
    displayName: "Grok Imagine 1.5",
    endpoint: "image_to_video",
    textOnlyEndpoint: "text_to_video",
    videoProfile: "grok",
    category: "video",
    creditsPerUnit: 16,
    creditUnit: "second",
    generationTypes: ["video"],
    prompt: { required: true, maxLength: 2500 },
    inputs: {
      kind: "standard",
      type: "image",
      minCount: 0,
      maxCount: 1,
      tagsAllowed: false,
      positionsRequired: true,
      allowedFileTypes: ["image/*"],
    },
    ratios: ["16:9", "9:16", "1:1", "4:3", "3:4", "3:2", "2:3"],
    additionalParams: {
      duration: { default: 6, min: 1, max: 15 },
      resolution: { default: "720p", options: ["480p", "720p", "1080p"] },
    },
  }),

  happyhorse_1_0: defineModel({
    displayName: "HappyHorse 1.0",
    endpoint: "image_to_video",
    textOnlyEndpoint: "text_to_video",
    videoProfile: "happyhorse",
    category: "video",
    creditsPerUnit: 15,
    creditUnit: "second",
    generationTypes: ["video"],
    prompt: { required: false, requiredWithoutInputs: true, maxLength: 2500 },
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
      "960:960",
      "1108:832",
      "832:1108",
      "1920:1080",
      "1080:1920",
      "1440:1440",
      "1662:1248",
      "1248:1662",
    ],
    additionalParams: {
      duration: { default: 5, min: 3, max: 15 },
      resolution: { default: "720p", options: ["720p", "1080p"] },
    },
  }),

  h3_max: defineModel({
    displayName: "H3 Max",
    endpoint: "image_to_video",
    textOnlyEndpoint: "text_to_video",
    videoProfile: "h3",
    category: "video",
    creditsPerUnit: 8,
    creditUnit: "second",
    generationTypes: ["video"],
    prompt: { required: true, maxLength: 6000 },
    inputs: {
      kind: "standard",
      type: "image",
      minCount: 0,
      maxCount: 2,
      tagsAllowed: false,
      positionsRequired: true,
      allowedFileTypes: ["image/*"],
    },
    ratios: [],
    supportsLastFrame: true,
    additionalParams: {
      duration: { default: 6, min: 5, max: 15 },
      resolution: { default: "768p", options: ["480p", "768p"] },
    },
  }),

  gemini_omni_flash: defineModel({
    displayName: "Gemini Omni Flash",
    endpoint: "image_to_video",
    textOnlyEndpoint: "text_to_video",
    videoEndpoint: "video_to_video",
    videoProfile: "gemini_omni",
    category: "video",
    creditsPerUnit: 10,
    creditUnit: "second",
    generationTypes: ["video"],
    prompt: { required: true, maxLength: 4000 },
    inputs: {
      kind: "standard",
      type: "media",
      minCount: 0,
      maxCount: 6,
      maxImages: 5,
      maxVideos: 1,
      tagsAllowed: false,
      positionsRequired: false,
      allowedFileTypes: ["image/*", "video/*"],
    },
    ratios: ["1280:720", "720:1280"],
    additionalParams: {
      duration: { default: 5, min: 3, max: 10 },
    },
  }),

  aleph2: defineModel({
    displayName: "Aleph 2.0",
    endpoint: "video_to_video",
    videoProfile: "aleph2",
    ratioParam: "targetAspectRatio",
    category: "video",
    creditsPerUnit: 28,
    creditUnit: "second",
    generationTypes: ["video"],
    prompt: { required: false, maxLength: 1000 },
    inputs: {
      kind: "standard",
      type: "video",
      minCount: 1,
      maxCount: 1,
      tagsAllowed: false,
      positionsRequired: false,
      allowedFileTypes: ["video/*"],
    },
    ratios: ["16:9", "9:16", "1:1", "4:3", "3:4", "3:2", "2:3", "21:9"],
  }),

  // ---- Video: Special endpoints ---------------------------------------------

  gen4_aleph: defineModel({
    displayName: "Gen-4 Aleph",
    listed: false,
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
    listed: false,
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

  magnific_video_upscaler_creative: defineModel({
    displayName: "Magnific Video Upscale",
    endpoint: "video_upscale",
    category: "upscale",
    creditsPerUnit: 27,
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
    additionalParams: {
      resolution: { default: "2k", options: ["720p", "1k", "2k", "4k"] },
    },
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
    prompt: { required: true, maxLength: 5500 },
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

  "gemini_image3.1_flash": defineModel({
    displayName: "Gemini Image 3.1 Flash",
    endpoint: "text_to_image",
    category: "image",
    creditsPerUnit: 10,
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
    ratios: GEMINI_31_FLASH_RATIOS,
  }),

  gpt_image_2_5_flare: defineModel({
    displayName: "GPT Image 2.5 Flare",
    endpoint: "text_to_image",
    category: "image",
    creditsPerUnit: 16,
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
    ratios: GPT_IMAGE_RATIOS,
  }),

  gpt_image_2_5_sunburst: defineModel({
    displayName: "GPT Image 2.5 Sunburst",
    endpoint: "text_to_image",
    category: "image",
    creditsPerUnit: 16,
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
    ratios: GPT_IMAGE_RATIOS,
  }),

  muse_image: defineModel({
    displayName: "Muse Image",
    endpoint: "text_to_image",
    category: "image",
    creditsPerUnit: 1,
    creditUnit: "image",
    generationTypes: ["image"],
    prompt: { required: true, maxLength: 4000 },
    inputs: {
      kind: "standard",
      type: "image",
      minCount: 0,
      maxCount: 10,
      tagsAllowed: false,
      positionsRequired: false,
      allowedFileTypes: ["image/*"],
    },
    ratios: [
      "1600:1600",
      "2016:1152",
      "1152:2016",
      "1920:1280",
      "1280:1920",
      "1792:1344",
      "1344:1792",
      "2352:1008",
      "auto",
    ],
  }),

  grok_imagine_image_2: defineModel({
    displayName: "Grok Imagine Image 2",
    endpoint: "text_to_image",
    category: "image",
    creditsPerUnit: 6,
    creditUnit: "image",
    generationTypes: ["image"],
    prompt: { required: true, maxLength: 2500 },
    inputs: {
      kind: "standard",
      type: "image",
      minCount: 0,
      maxCount: 3,
      tagsAllowed: false,
      positionsRequired: false,
      allowedFileTypes: ["image/*"],
    },
    ratios: [
      "1024:1024",
      "1280:720",
      "720:1280",
      "1152:864",
      "864:1152",
      "1248:832",
      "832:1248",
      "2048:2048",
      "2816:1584",
      "1584:2816",
      "auto_1k",
      "auto_2k",
    ],
  }),

  seedream5_pro: defineModel({
    displayName: "Seedream 5 Pro",
    endpoint: "text_to_image",
    category: "image",
    creditsPerUnit: 5,
    creditUnit: "image",
    generationTypes: ["image"],
    prompt: { required: true, maxLength: 4000 },
    inputs: {
      kind: "standard",
      type: "image",
      minCount: 0,
      maxCount: 10,
      tagsAllowed: false,
      positionsRequired: false,
      allowedFileTypes: ["image/*"],
    },
    ratios: [
      "1024:1024",
      "1184:896",
      "896:1184",
      "1376:768",
      "768:1376",
      "1296:864",
      "864:1296",
      "2048:2048",
      "2304:1728",
      "1728:2304",
      "2720:1530",
      "1530:2720",
      "2496:1664",
      "1664:2496",
      "auto_1k",
      "auto_2k",
    ],
  }),

  seedream5_lite: defineModel({
    displayName: "Seedream 5 Lite",
    endpoint: "text_to_image",
    category: "image",
    creditsPerUnit: 4,
    creditUnit: "image",
    generationTypes: ["image"],
    prompt: { required: true, maxLength: 4000 },
    inputs: {
      kind: "standard",
      type: "image",
      minCount: 0,
      maxCount: 14,
      tagsAllowed: false,
      positionsRequired: false,
      allowedFileTypes: ["image/*"],
    },
    ratios: [
      "2048:2048",
      "2304:1728",
      "1728:2304",
      "2848:1600",
      "1600:2848",
      "2496:1664",
      "1664:2496",
      "3136:1344",
      "3072:3072",
      "3456:2592",
      "2592:3456",
      "4096:2304",
      "2304:4096",
      "3744:2496",
      "2496:3744",
      "4704:2016",
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
  gemini_image3_1_flash: "gemini_image3.1_flash",
}

/**
 * Billing / usage API keys that are not in {@link MODEL_REGISTRY} but should show a
 * readable name in dashboards (e.g. settings usage charts).
 */
const RUNWAY_USAGE_MODEL_LABELS: Record<string, string> = {
  gwm1_avatar_async_audio_to_video: "GWM-1 Avatar (audio to video)",
  gwm1_avatar_async_text_to_video: "GWM-1 Avatar (text to video)",
  gwm1_avatars: "GWM-1 Avatars",
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
  options?: { includeUnlisted?: boolean },
): { id: Model; definition: ModelDefinition }[] {
  return (Object.entries(MODEL_REGISTRY) as [Model, ModelDefinition][]).filter(
    ([, def]) =>
      def.generationTypes.includes(type) &&
      (options?.includeUnlisted || def.listed !== false),
  ).map(([id, definition]) => ({ id, definition }))
}

export function promptTextIsRequired(modelId: string, inputCount: number): boolean {
  const config = MODEL_REGISTRY[resolveModel(modelId)]
  if (config.prompt.required) return true
  if (config.prompt.requiredWithoutInputs && inputCount === 0) return true
  return false
}

/** Pick the Runway endpoint for a model given the media that will be sent. */
export function selectEndpoint(
  modelId: string,
  assets: { type?: "image" | "video" }[],
): EndpointType {
  const def = MODEL_REGISTRY[resolveModel(modelId)]
  const images = assets.filter((asset) => asset.type !== "video")
  const videos = assets.filter((asset) => asset.type === "video")

  if (def.videoProfile === "wan") {
    return images.length > 0 ? "image_to_video" : "text_to_video"
  }

  if (def.videoProfile === "aleph2") return "video_to_video"

  if (
    videos.length > 0 &&
    def.videoEndpoint &&
    (def.videoProfile === "seedance" ||
      def.videoProfile === "hailuo" ||
      def.videoProfile === "gemini_omni")
  ) {
    return def.videoEndpoint
  }

  if (assets.length === 0 && def.textOnlyEndpoint) return def.textOnlyEndpoint
  return def.endpoint
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
