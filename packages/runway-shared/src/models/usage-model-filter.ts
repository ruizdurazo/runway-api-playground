import { MODEL_ALIASES } from "./registry.js"

/**
 * Collapse billing keys that are {@link MODEL_ALIASES aliases} of the same logical model
 * (e.g. `gemini_image3.1_flash` → `gemini_2.5_flash`) so usage tables and charts do not
 * show duplicate rows under the same display name.
 */
export function canonicalUsageModelId(model: string): string {
  const seen = new Set<string>()
  let id = model
  while (id in MODEL_ALIASES) {
    if (seen.has(id)) return model
    seen.add(id)
    id = MODEL_ALIASES[id]!
  }
  return id
}

/**
 * Usage / organization APIs may return billing keys for non-visual models (voice, TTS,
 * dubbing, GWM avatars, etc.). Use this to hide those rows from analytics UI.
 */
export function isExcludedNonVisualUsageModel(model: string): boolean {
  const m = model.toLowerCase()
  return (
    m.startsWith("gwm") ||
    m.startsWith("eleven_") ||
    m.startsWith("elevenlabs") ||
    m.includes("text_to_speech") ||
    m.includes("text-to-speech") ||
    m.includes("_tts") ||
    m.includes("tts_") ||
    m.includes("dubbing") ||
    m.includes("voice_isolation") ||
    m.includes("clean_audio") ||
    m.includes("sound_effect") ||
    m.includes("voice_dubbing") ||
    m.includes("speech_synthesis") ||
    m.includes("voice_processing")
  )
}

export function isVisualGenerationModelForUsage(model: string): boolean {
  return !isExcludedNonVisualUsageModel(model)
}
