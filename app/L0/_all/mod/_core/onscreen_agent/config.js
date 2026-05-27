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
  { id: "dark", label: "Dark", icon: "🌙", description: "Dark theme" },
  { id: "light", label: "Light", icon: "☀️", description: "Light theme" },
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
  }
]);

export const DEFAULT_CHARACTER_ID = "default";
export const CHARACTER_STORAGE_KEY = "space.character";

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
