export const GENERATION_MODES = [
  "display_focused",
  "cost_focused",
  "production_focused"
] as const;

export type GenerationMode = (typeof GENERATION_MODES)[number];

export function isGenerationMode(value: unknown): value is GenerationMode {
  return typeof value === "string" && (GENERATION_MODES as readonly string[]).includes(value);
}
