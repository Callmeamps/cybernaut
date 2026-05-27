import fs from "node:fs/promises";
import path from "node:path";

import { parseSimpleYaml } from "../../app/L0/_all/mod/_core/framework/js/yaml-lite.js";

const DEFAULT_AGENT_CONFIG_PATH = path.join(
  import.meta.dirname,
  "../../app/L0/_all/mod/_core/onscreen_agent/config.js"
);

async function loadUserAgentConfig(username) {
  if (!username) {
    return {};
  }

  try {
    const configPath = path.join(
      import.meta.dirname,
      "../../app/L2",
      username,
      "conf",
      "onscreen-agent.yaml"
    );
    const raw = await fs.readFile(configPath, "utf8");
    return parseSimpleYaml(raw) || {};
  } catch {
    return {};
  }
}

export async function get(context) {
  const { user } = context;
  const userConfig = await loadUserAgentConfig(user?.username);

  return {
    ok: true,
    agent: {
      name: "Space Agent Lite",
      version: "0.1.0",
      runtime: "browser-first",
      hasApiKey: Boolean(userConfig.apiKey?.trim()),
      model: userConfig.model || "openai/gpt-4o",
      apiEndpoint: userConfig.apiEndpoint || "https://openrouter.ai/api/v1/chat/completions",
      provider: userConfig.provider || "api"
    },
    user: {
      username: user?.username || null,
      isAuthenticated: Boolean(user?.isAuthenticated)
    },
    endpoints: {
      chat: "/api/agent_chat",
      status: "/api/agent_status",
      skills: "/api/agent_skills",
      health: "/api/health"
    },
    docs: {
      chat: "POST /api/agent_chat with {messages: [{role, content}], stream: true}",
      curl: 'curl -N -X POST http://localhost:3000/api/agent_chat -H "Content-Type: application/json" -d \'{"messages":[{"role":"user","content":"Hello"}]}\''
    }
  };
}
