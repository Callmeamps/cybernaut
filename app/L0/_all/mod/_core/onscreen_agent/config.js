import { DEFAULT_PROMPT_BUDGET_RATIOS, normalizePromptBudgetRatios } from "/mod/_core/agent_prompt/prompt-items.js";

export const ONSCREEN_AGENT_CONFIG_PATH = "~/conf/onscreen-agent.yaml";
export const ONSCREEN_AGENT_HISTORY_PATH = "~/hist/onscreen-agent.json";
export const ONSCREEN_AGENT_UI_STATE_STORAGE_KEY = "space.onscreenAgent.uiState";
export const DEFAULT_ONSCREEN_AGENT_MAX_TOKENS = 120_000;
export const ONSCREEN_AGENT_LLM_PROVIDER = Object.freeze({
  API: "api",
  LOCAL: "local"
});
export const ONSCREEN_AGENT_LOCAL_PROVIDER = Object.freeze({
  HUGGINGFACE: "huggingface"
});
export const ONSCREEN_AGENT_HIDDEN_EDGE = Object.freeze({
  BOTTOM: "bottom",
  LEFT: "left",
  RIGHT: "right",
  TOP: "top"
});

export const DEFAULT_ONSCREEN_AGENT_SETTINGS = {
  apiEndpoint: "https://openrouter.ai/api/v1/chat/completions",
  apiKey: "",
  huggingfaceDtype: "q4",
  huggingfaceModel: "",
  localProvider: ONSCREEN_AGENT_LOCAL_PROVIDER.HUGGINGFACE,
  maxTokens: DEFAULT_ONSCREEN_AGENT_MAX_TOKENS,
  model: "openai/gpt-4o",
  paramsText: "temperature:0.2",
  promptBudgetRatios: { ...DEFAULT_PROMPT_BUDGET_RATIOS },
  provider: ONSCREEN_AGENT_LLM_PROVIDER.API
};

// ─── Curated model list ──────────────────────────────────────────────────────
// Each entry: { id, label, provider, endpoint?, contextWindow, description }
// `endpoint` overrides the default API endpoint when the model is selected.

export const MODELS = Object.freeze([
  // ── Anthropic (via OpenRouter) ────────────────────────────────────────────
  {
    id: "anthropic/claude-sonnet-4-20250514",
    label: "Claude 4 Sonnet",
    group: "Anthropic",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    contextWindow: 200000,
    description: "Best coding and agentic model"
  },
  {
    id: "anthropic/claude-opus-4-20250514",
    label: "Claude 4 Opus",
    group: "Anthropic",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    contextWindow: 200000,
    description: "Most capable Claude model"
  },
  {
    id: "anthropic/claude-haiku-4-20250514",
    label: "Claude 4 Haiku",
    group: "Anthropic",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    contextWindow: 200000,
    description: "Fastest Claude model"
  },
  {
    id: "anthropic/claude-sonnet-3.7",
    label: "Claude 3.7 Sonnet",
    group: "Anthropic",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    contextWindow: 200000,
    description: "Previous-gen Claude Sonnet"
  },

  // ── OpenAI (via OpenRouter) ───────────────────────────────────────────────
  {
    id: "openai/gpt-4o",
    label: "GPT-4o",
    group: "OpenAI",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    contextWindow: 128000,
    description: "GPT-4o with vision"
  },
  {
    id: "openai/gpt-4o-mini",
    label: "GPT-4o Mini",
    group: "OpenAI",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    contextWindow: 128000,
    description: "Fast, affordable GPT-4o"
  },
  {
    id: "openai/gpt-4-turbo",
    label: "GPT-4 Turbo",
    group: "OpenAI",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    contextWindow: 128000,
    description: "GPT-4 Turbo with vision"
  },
  {
    id: "openai/o3",
    label: "o3",
    group: "OpenAI",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    contextWindow: 200000,
    description: "Advanced reasoning model"
  },
  {
    id: "openai/o4-mini",
    label: "o4-mini",
    group: "OpenAI",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    contextWindow: 200000,
    description: "Lightweight reasoning model"
  },

  // ── Google (via OpenRouter) ───────────────────────────────────────────────
  {
    id: "google/gemini-2.5-pro-preview",
    label: "Gemini 2.5 Pro",
    group: "Google",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    contextWindow: 1000000,
    description: "Google's most advanced model"
  },
  {
    id: "google/gemini-2.0-flash",
    label: "Gemini 2.0 Flash",
    group: "Google",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    contextWindow: 1000000,
    description: "Fast Gemini with low latency"
  },
  {
    id: "google/gemini-2.5-flash-preview-04-17",
    label: "Gemini 2.5 Flash",
    group: "Google",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    contextWindow: 1000000,
    description: "Latest Gemini Flash"
  },

  // ── Meta (via OpenRouter) ─────────────────────────────────────────────────
  {
    id: "meta-llama/llama-4-maverick",
    label: "Llama 4 Maverick",
    group: "Meta",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    contextWindow: 1000000,
    description: "Meta's largest open model"
  },
  {
    id: "meta-llama/llama-4-scout",
    label: "Llama 4 Scout",
    group: "Meta",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    contextWindow: 32000,
    description: "Lightweight Llama 4"
  },
  {
    id: "meta-llama/llama-3.3-70b-instruct",
    label: "Llama 3.3 70B",
    group: "Meta",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    contextWindow: 128000,
    description: "Latest Llama 3.3"
  },

  // ── Mistral (via OpenRouter) ──────────────────────────────────────────────
  {
    id: "mistralai/mistral-large-3",
    label: "Mistral Large 3",
    group: "Mistral",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    contextWindow: 128000,
    description: "Mistral's flagship model"
  },
  {
    id: "mistralai/mixtral-8x7b-instruct",
    label: "Mixtral 8x7B",
    group: "Mistral",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    contextWindow: 32000,
    description: "Open-source MoE model"
  },

  // ── DeepSeek (via OpenRouter) ─────────────────────────────────────────────
  {
    id: "deepseek/deepseek-v3",
    label: "DeepSeek V3",
    group: "DeepSeek",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    contextWindow: 128000,
    description: "DeepSeek's latest model"
  },
  {
    id: "deepseek/deepseek-r1",
    label: "DeepSeek R1",
    group: "DeepSeek",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    contextWindow: 65536,
    description: "DeepSeek reasoning model"
  },

  // ── xAI (via OpenRouter) ──────────────────────────────────────────────────
  {
    id: "x-ai/grok-3-beta",
    label: "Grok 3 Beta",
    group: "xAI",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    contextWindow: 131072,
    description: "xAI's Grok model"
  },

  // ── Direct OpenAI ─────────────────────────────────────────────────────────
  {
    id: "openai/native:gpt-4o",
    label: "GPT-4o (Direct)",
    group: "Direct OpenAI",
    endpoint: "https://api.openai.com/v1/chat/completions",
    contextWindow: 128000,
    description: "Direct OpenAI API"
  },
  {
    id: "openai/native:gpt-4o-mini",
    label: "GPT-4o Mini (Direct)",
    group: "Direct OpenAI",
    endpoint: "https://api.openai.com/v1/chat/completions",
    contextWindow: 128000,
    description: "Direct OpenAI API"
  },

  // ── Direct Anthropic ──────────────────────────────────────────────────────
  {
    id: "anthropic/native:claude-sonnet-4-20250514",
    label: "Claude 4 Sonnet (Direct)",
    group: "Direct Anthropic",
    endpoint: "https://api.anthropic.com/v1/messages",
    contextWindow: 200000,
    description: "Direct Anthropic API"
  },

  // ── Custom (always last) ──────────────────────────────────────────────────
  {
    id: "__custom__",
    label: "Custom Model…",
    group: "Other",
    endpoint: null,
    contextWindow: null,
    description: "Enter any model ID manually"
  }
]);

export const MODELS_BY_ID = Object.freeze(
  Object.fromEntries(MODELS.map((m) => [m.id, m]))
);

export const MODEL_GROUPS = Object.freeze(
  [...new Set(MODELS.map((m) => m.group))]
);

export function resolveModelRecord(modelId) {
  if (!modelId) return null;
  return MODELS_BY_ID[modelId] || null;
}

export function isCustomModel(modelId) {
  return modelId === "__custom__" || !MODELS_BY_ID[modelId];
}

export function getModelDefaultEndpoint(modelId) {
  const record = resolveModelRecord(modelId);
  return record?.endpoint || DEFAULT_ONSCREEN_AGENT_SETTINGS.apiEndpoint;
}

export function normalizeModelId(value) {
  return String(value ?? "").trim();
}

// ─── Themes ──────────────────────────────────────────────────────────────────

export const THEMES = Object.freeze([
  { id: "dark", label: "Dark", icon: "🌙", description: "Dark space theme" },
  { id: "light", label: "Light", icon: "☀️", description: "Light theme" },
  { id: "oled", label: "OLED", icon: "⬛", description: "Pure black OLED theme" },
  { id: "high-contrast", label: "High Contrast", icon: "🔲", description: "Maximum contrast for accessibility" },
  { id: "system", label: "System", icon: "💻", description: "Follow OS preference" }
]);

export const DEFAULT_THEME = "dark";
export const THEME_STORAGE_KEY = "space.theme";

export const CHARACTERS = Object.freeze([
  {
    id: "default",
    name: "Space Agent",
    emoji: "🤖",
    avatar: "/mod/_core/visual/res/chat/overlay/astronaut_no_bg.webp",
    description: "The default Space Agent",
    systemPromptPrefix: ""
  },
  {
    id: "robot",
    name: "BEEP-BOOP",
    emoji: "🦾",
    avatar: "",
    description: "Cheerful robot assistant",
    systemPromptPrefix: "You are a cheerful robot assistant called BEEP-BOOP. You speak with enthusiasm and occasional mechanical metaphors."
  },
  {
    id: "sage",
    name: "Sage",
    emoji: "🧙",
    avatar: "",
    description: "Wise old wizard",
    systemPromptPrefix: "You are Sage, a wise old wizard. You speak with measured wisdom and use occasional metaphors involving magic and nature."
  },
  {
    id: "cat",
    name: "Whiskers",
    emoji: "🐱",
    avatar: "",
    description: "Clever, curious cat",
    systemPromptPrefix: "You are Whiskers, a very clever cat. You are curious and resourceful but occasionally aloof."
  },
  {
    id: "professional",
    name: "Atlas",
    emoji: "💼",
    avatar: "",
    description: "Professional executive assistant",
    systemPromptPrefix: "You are Atlas, a professional executive assistant. You are concise, formal, and highly efficient."
  },
  {
    id: "pirate",
    name: "Captain Byte",
    emoji: "🏴‍☠️",
    avatar: "",
    description: "Tech-savvy pirate",
    systemPromptPrefix: "You are Captain Byte, a fearsome tech pirate. You speak in pirate slang about programming, data, and technology."
  },
  {
    id: "admin",
    name: "Commander",
    emoji: "🎖️",
    avatar: "/mod/_core/visual/res/chat/admin/astronaut_no_bg.webp",
    description: "Mission control commander",
    systemPromptPrefix: "You are Commander, a seasoned mission control operator. You are calm under pressure, precise with terminology, and always thinking three steps ahead. You speak with quiet authority."
  },
  {
    id: "engineer",
    name: "Chief",
    emoji: "🔧",
    avatar: "/mod/_core/visual/res/engineer/astronaut_red_no_bg.png",
    description: "Chief engineer, red alert specialist",
    systemPromptPrefix: "You are Chief, the chief engineer. You are practical, resourceful, and speak in direct technical terms. You solve problems with elegant engineering solutions and occasional dry humor."
  },
  {
    id: "alien",
    name: "Zyx",
    emoji: "👽",
    avatar: "",
    description: "Curious alien scientist",
    systemPromptPrefix: "You are Zyx, an alien scientist visiting Earth. You are endlessly curious about human customs and technology. You speak with wonder and occasionally misunderstand idioms in charming ways."
  },
  {
    id: "detective",
    name: "Clue",
    emoji: "🕵️",
    avatar: "",
    description: "Methodical detective",
    systemPromptPrefix: "You are Clue, a methodical detective. You approach every problem by gathering evidence, forming hypotheses, and following the logic wherever it leads. You speak precisely and ask probing questions."
  }
]);

export const DEFAULT_CHARACTER_ID = "default";
export const CHARACTER_STORAGE_KEY = "space.character";

// ─── Custom Theme & Character Storage Keys ─────────────────────────────────

export const CUSTOM_THEMES_STORAGE_KEY = "space.customThemes";
export const CUSTOM_CHARACTERS_STORAGE_KEY = "space.customCharacters";

// ─── Theme Color Keys ──────────────────────────────────────────────────────
// All CSS custom properties that a custom theme can override.
// Used by the theme creator UI to generate color input rows.

export const THEME_COLOR_KEYS = Object.freeze([
  "--color-canvas",
  "--color-canvas-elevated",
  "--color-canvas-deep",
  "--color-surface-1",
  "--color-surface-2",
  "--color-surface-3",
  "--color-surface-glass",
  "--color-border-soft",
  "--color-border-strong",
  "--color-text-primary",
  "--color-text-secondary",
  "--color-text-tertiary",
  "--color-accent-primary",
  "--color-accent-primary-strong",
  "--color-accent-primary-soft",
  "--color-accent-secondary",
  "--color-accent-ink",
  "--color-status-success",
  "--color-status-warning",
  "--color-status-danger",
  "--color-layer-overlay",
  "--color-backdrop-glow-primary",
  "--color-backdrop-glow-secondary",
  "--color-backdrop-glow-depth",
  "--color-backdrop-star-strong",
  "--color-backdrop-star-soft",
  "--color-backdrop-star-accent",
  "--color-backdrop-star-halo",
  "--color-backdrop-star-halo-accent"
]);

// ─── Base Palette Maps ─────────────────────────────────────────────────────
// Static copies of the default :root (dark) and .theme-light values from colors.css.
// Used by the theme creator to provide "reset to default" and as the foundation
// for custom theme merging.

export const THEME_BASE_DARK = Object.freeze({
  "--color-canvas": "#050816",
  "--color-canvas-elevated": "#09111f",
  "--color-canvas-deep": "#02050d",
  "--color-surface-1": "#0d1628",
  "--color-surface-2": "#121d33",
  "--color-surface-3": "#182540",
  "--color-surface-glass": "rgba(11, 18, 34, 0.78)",
  "--color-border-soft": "rgba(148, 167, 201, 0.16)",
  "--color-border-strong": "rgba(168, 186, 219, 0.28)",
  "--color-text-primary": "#f3f7ff",
  "--color-text-secondary": "#b8c4da",
  "--color-text-tertiary": "#8e9bb2",
  "--color-accent-primary": "#7ddcff",
  "--color-accent-primary-strong": "#94bcff",
  "--color-accent-primary-soft": "rgba(125, 220, 255, 0.14)",
  "--color-accent-secondary": "#79edd8",
  "--color-accent-ink": "#04101d",
  "--color-status-success": "#7ce4b0",
  "--color-status-warning": "#ffc56f",
  "--color-status-danger": "#ff8d98",
  "--color-layer-overlay": "rgba(2, 7, 17, 0.68)",
  "--color-backdrop-glow-primary": "rgba(148, 188, 255, 0.18)",
  "--color-backdrop-glow-secondary": "rgba(121, 237, 216, 0.14)",
  "--color-backdrop-glow-depth": "rgba(59, 95, 172, 0.26)",
  "--color-backdrop-star-strong": "rgba(255, 255, 255, 0.76)",
  "--color-backdrop-star-soft": "rgba(255, 255, 255, 0.26)",
  "--color-backdrop-star-accent": "rgba(148, 188, 255, 0.48)",
  "--color-backdrop-star-halo": "rgba(255, 255, 255, 0.12)",
  "--color-backdrop-star-halo-accent": "rgba(148, 188, 255, 0.16)"
});

export const THEME_BASE_LIGHT = Object.freeze({
  "--color-canvas": "#f0f4f8",
  "--color-canvas-elevated": "#ffffff",
  "--color-canvas-deep": "#e8ecf1",
  "--color-surface-1": "#ffffff",
  "--color-surface-2": "#f5f7fa",
  "--color-surface-3": "#ebeef2",
  "--color-surface-glass": "rgba(255, 255, 255, 0.82)",
  "--color-border-soft": "rgba(30, 50, 80, 0.12)",
  "--color-border-strong": "rgba(30, 50, 80, 0.22)",
  "--color-text-primary": "#1a2332",
  "--color-text-secondary": "#4a5a6e",
  "--color-text-tertiary": "#7a8a9e",
  "--color-accent-primary": "#0077b6",
  "--color-accent-primary-strong": "#005f8a",
  "--color-accent-primary-soft": "rgba(0, 119, 182, 0.10)",
  "--color-accent-secondary": "#00897b",
  "--color-accent-ink": "#ffffff",
  "--color-status-success": "#2e7d32",
  "--color-status-warning": "#e65100",
  "--color-status-danger": "#c62828",
  "--color-layer-overlay": "rgba(0, 0, 0, 0.32)",
  "--color-backdrop-glow-primary": "rgba(0, 95, 138, 0.10)",
  "--color-backdrop-glow-secondary": "rgba(0, 137, 123, 0.08)",
  "--color-backdrop-glow-depth": "rgba(0, 60, 100, 0.12)",
  "--color-backdrop-star-strong": "rgba(30, 50, 80, 0.55)",
  "--color-backdrop-star-soft": "rgba(30, 50, 80, 0.18)",
  "--color-backdrop-star-accent": "rgba(0, 95, 138, 0.30)",
  "--color-backdrop-star-halo": "rgba(30, 50, 80, 0.08)",
  "--color-backdrop-star-halo-accent": "rgba(0, 95, 138, 0.10)"
});

export function getThemeBaseColors(base) {
  return base === "light"
    ? { ...THEME_BASE_LIGHT }
    : { ...THEME_BASE_DARK };
}

// ─── Validation Helpers ────────────────────────────────────────────────────

export function validateCustomTheme(theme, existingCustoms) {
  const errors = [];
  if (!theme.id || typeof theme.id !== "string" || !theme.id.trim())
    errors.push("Theme ID is required");
  if (!theme.label || typeof theme.label !== "string" || !theme.label.trim())
    errors.push("Display name is required");
  if (theme.label && theme.label.length > 40)
    errors.push("Display name must be ≤40 chars");
  if (!["dark", "light"].includes(theme.base))
    errors.push("Base palette must be 'dark' or 'light'");
  if (!theme.colors || typeof theme.colors !== "object" || Array.isArray(theme.colors))
    errors.push("Colors object is required");
  // Check id uniqueness against built-in THEMES
  if (THEMES.some(t => t.id === theme.id))
    errors.push(`id '${theme.id}' conflicts with a built-in theme`);
  // Check id uniqueness against existing customs
  if (existingCustoms.some(t => t.id === theme.id))
    errors.push(`id '${theme.id}' already exists`);
  // Validate color keys
  for (const key of Object.keys(theme.colors || {})) {
    if (!key.startsWith("--color-"))
      errors.push(`Invalid color key '${key}' — must start with '--color-'`);
    const val = theme.colors[key];
    if (typeof val !== "string" || !val.trim() || val.includes(";"))
      errors.push(`Invalid value for '${key}'`);
  }
  return errors;
}

export function validateCustomCharacter(character, existingCustoms) {
  const errors = [];
  if (!character.id || typeof character.id !== "string" || !character.id.trim())
    errors.push("Character ID is required");
  if (!character.name || typeof character.name !== "string" || !character.name.trim())
    errors.push("Display name is required");
  if (character.name && character.name.length > 30)
    errors.push("Display name must be ≤30 chars");
  if (!character.emoji || typeof character.emoji !== "string" || !character.emoji.trim())
    errors.push("Emoji is required");
  if (character.description && character.description.length > 80)
    errors.push("Description must be ≤80 chars");
  if (character.systemPromptPrefix && character.systemPromptPrefix.length > 2000)
    errors.push("System prompt prefix must be ≤2000 chars");
  // Check id uniqueness against built-in CHARACTERS
  if (CHARACTERS.some(c => c.id === character.id))
    errors.push(`id '${character.id}' conflicts with a built-in character`);
  // Check id uniqueness against existing customs
  if (existingCustoms.some(c => c.id === character.id))
    errors.push(`id '${character.id}' already exists`);
  return errors;
}

function normalizeOnscreenAgentSettingText(value) {
  return String(value ?? "").trim();
}

export function normalizeOnscreenAgentLlmProvider(value) {
  return value === ONSCREEN_AGENT_LLM_PROVIDER.LOCAL
    ? ONSCREEN_AGENT_LLM_PROVIDER.LOCAL
    : ONSCREEN_AGENT_LLM_PROVIDER.API;
}

export function normalizeOnscreenAgentLocalProvider(value) {
  return ONSCREEN_AGENT_LOCAL_PROVIDER.HUGGINGFACE;
}

export function createOnscreenAgentHuggingFaceSelectionValue(modelId, dtype) {
  const normalizedModelId = String(modelId || "").trim();
  const normalizedDtype = String(dtype || "").trim();

  if (!normalizedModelId || !normalizedDtype) {
    return "";
  }

  return JSON.stringify({
    dtype: normalizedDtype,
    modelId: normalizedModelId
  });
}

export function parseOnscreenAgentHuggingFaceSelectionValue(value) {
  const rawValue = String(value || "").trim();

  if (!rawValue) {
    return {
      dtype: "",
      modelId: ""
    };
  }

  try {
    const parsedValue = JSON.parse(rawValue);

    return {
      dtype: String(parsedValue?.dtype || "").trim(),
      modelId: String(parsedValue?.modelId || "").trim()
    };
  } catch {
    return {
      dtype: "",
      modelId: ""
    };
  }
}

export function getOnscreenAgentLocalModelSelection(settings = {}) {
  const provider = normalizeOnscreenAgentLocalProvider(settings.localProvider);

  return {
    dtype: String(settings.huggingfaceDtype || "").trim(),
    modelId: String(settings.huggingfaceModel || "").trim(),
    provider
  };
}

export function isDefaultOnscreenAgentLlmSettings(settings) {
  const normalizedSettings = settings && typeof settings === "object" ? settings : {};

  return (
    normalizeOnscreenAgentLlmProvider(normalizedSettings.provider) ===
      DEFAULT_ONSCREEN_AGENT_SETTINGS.provider &&
    normalizeOnscreenAgentSettingText(normalizedSettings.apiEndpoint) ===
      normalizeOnscreenAgentSettingText(DEFAULT_ONSCREEN_AGENT_SETTINGS.apiEndpoint) &&
    normalizeOnscreenAgentSettingText(normalizedSettings.model) ===
      normalizeOnscreenAgentSettingText(DEFAULT_ONSCREEN_AGENT_SETTINGS.model) &&
    normalizeOnscreenAgentMaxTokens(normalizedSettings.maxTokens) === DEFAULT_ONSCREEN_AGENT_SETTINGS.maxTokens &&
    normalizeOnscreenAgentSettingText(normalizedSettings.paramsText) ===
      normalizeOnscreenAgentSettingText(DEFAULT_ONSCREEN_AGENT_SETTINGS.paramsText)
  );
}

export function normalizeOnscreenAgentHistoryHeight(value) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return null;
  }

  return Math.round(parsedValue);
}

export function normalizeOnscreenAgentHiddenEdge(value) {
  switch (value) {
    case ONSCREEN_AGENT_HIDDEN_EDGE.LEFT:
    case ONSCREEN_AGENT_HIDDEN_EDGE.RIGHT:
    case ONSCREEN_AGENT_HIDDEN_EDGE.BOTTOM:
      return value;
    default:
      return "";
  }
}

function normalizeMaxTokensText(value) {
  return String(value ?? "")
    .trim()
    .replace(/[,_\s]+/gu, "");
}

export function parseOnscreenAgentMaxTokens(value) {
  const normalizedValue = normalizeMaxTokensText(value);

  if (!normalizedValue) {
    return DEFAULT_ONSCREEN_AGENT_MAX_TOKENS;
  }

  if (!/^\d+$/u.test(normalizedValue)) {
    throw new Error("Max tokens must be a positive whole number.");
  }

  const parsedValue = Number(normalizedValue);

  if (!Number.isSafeInteger(parsedValue) || parsedValue < 1) {
    throw new Error("Max tokens must be a positive whole number.");
  }

  return parsedValue;
}

export function normalizeOnscreenAgentMaxTokens(value) {
  try {
    return parseOnscreenAgentMaxTokens(value);
  } catch {
    return DEFAULT_ONSCREEN_AGENT_MAX_TOKENS;
  }
}

export function normalizeOnscreenAgentPromptBudgetRatios(value = {}) {
  return normalizePromptBudgetRatios(value);
}

export function formatOnscreenAgentTokenCount(tokenCount) {
  const normalizedCount = Number.isFinite(tokenCount) ? Math.max(0, Math.round(tokenCount)) : 0;

  if (normalizedCount > 100_000) {
    return `${Math.round(normalizedCount / 1000)}k`;
  }

  if (normalizedCount > 1000) {
    return `${(normalizedCount / 1000).toFixed(1)}k`;
  }

  return String(normalizedCount);
}
