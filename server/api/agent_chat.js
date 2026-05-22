import fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

import { parseSimpleYaml } from "../../app/L0/_all/mod/_core/framework/js/yaml-lite.js";

const DEFAULT_SYSTEM_PROMPT_PATH = path.join(
  import.meta.dirname,
  "../../app/L0/_all/mod/_core/onscreen_agent/prompts/system-prompt.md"
);

const DEFAULT_AGENT_CONFIG = {
  apiEndpoint: "https://openrouter.ai/api/v1/chat/completions",
  model: "anthropic/claude-sonnet-4.6",
  apiKey: "",
  temperature: 0.2
};

function resolveUserConfigDir(username) {
  if (!username) {
    return null;
  }

  return path.join(
    import.meta.dirname,
    "../../app/L2",
    username,
    "conf"
  );
}

async function loadUserAgentConfig(username) {
  const configDir = resolveUserConfigDir(username);

  if (!configDir) {
    return {};
  }

  try {
    const configPath = path.join(configDir, "onscreen-agent.yaml");
    const raw = await fs.readFile(configPath, "utf8");
    return parseSimpleYaml(raw) || {};
  } catch {
    return {};
  }
}

async function loadSystemPrompt() {
  try {
    return await fs.readFile(DEFAULT_SYSTEM_PROMPT_PATH, "utf8");
  } catch {
    return "You are a helpful AI assistant.";
  }
}

function resolveConfig(userConfig, overrides = {}) {
  return {
    apiEndpoint: String(overrides.apiEndpoint || userConfig.apiEndpoint || DEFAULT_AGENT_CONFIG.apiEndpoint).trim(),
    apiKey: String(overrides.apiKey || userConfig.apiKey || DEFAULT_AGENT_CONFIG.apiKey).trim(),
    model: String(overrides.model || userConfig.model || DEFAULT_AGENT_CONFIG.model).trim(),
    temperature: Number(overrides.temperature ?? userConfig.temperature ?? DEFAULT_AGENT_CONFIG.temperature)
  };
}

function buildUpstreamRequest(messages, config, stream = true) {
  return {
    model: config.model,
    stream,
    temperature: config.temperature,
    messages
  };
}

function buildUpstreamHeaders(config) {
  const headers = {
    "Content-Type": "application/json"
  };

  if (config.apiKey) {
    headers.Authorization = `Bearer ${config.apiKey}`;
  }

  if (config.apiEndpoint.includes("openrouter.ai")) {
    headers["HTTP-Referer"] = "https://space-agent-lite";
    headers["X-OpenRouter-Title"] = "Space Agent Lite";
  }

  return headers;
}

function sendSSEHeaders(res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no"
  });
}

function sendSSEEvent(res, data) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function sendSSEDone(res) {
  res.write("data: [DONE]\n\n");
  res.end();
}

function sendSSEError(res, message) {
  sendSSEEvent(res, {
    choices: [{
      delta: { content: `\n\n[Error: ${message}]` },
      finish_reason: "stop"
    }]
  });
  sendSSEDone(res);
}

function createStreamingChunk(content, finishReason = null) {
  const chunk = {
    id: `chatcmpl-${Date.now()}`,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model: "",
    choices: [{
      index: 0,
      delta: {},
      finish_reason: finishReason
    }]
  };

  if (content) {
    chunk.choices[0].delta = { content };
  }

  return chunk;
}

async function streamProxyResponse(upstreamRes, res) {
  sendSSEHeaders(res);

  const reader = upstreamRes.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();

        if (!trimmed || !trimmed.startsWith("data:")) {
          continue;
        }

        const data = trimmed.slice(5).trim();

        if (data === "[DONE]") {
          sendSSEDone(res);
          return;
        }

        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content || "";

          if (content) {
            res.write(`data: ${JSON.stringify(createStreamingChunk(content))}\n\n`);
          }
        } catch {
          res.write(`${trimmed}\n\n`);
        }
      }
    }

    if (buffer.trim()) {
      const trimmed = buffer.trim();

      if (trimmed === "data: [DONE]") {
        sendSSEDone(res);
      } else if (trimmed.startsWith("data:")) {
        res.write(`${trimmed}\n\n`);
        sendSSEDone(res);
      }
    } else {
      sendSSEDone(res);
    }
  } catch (error) {
    sendSSEError(res, error.message);
  }
}

async function handleNonStreamingResponse(upstreamRes, res) {
  const payload = await upstreamRes.json();
  res.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8"
  });
  res.end(JSON.stringify(payload, null, 2));
}

async function handleAgentChat(context) {
  const { body, req, res, user } = context;

  if (!body || typeof body !== "object") {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Request body must be JSON." }));
    return;
  }

  const userConfig = await loadUserAgentConfig(user?.username);
  const config = resolveConfig(userConfig, {
    apiEndpoint: body.api_endpoint || body.apiEndpoint,
    apiKey: body.api_key || body.apiKey,
    model: body.model,
    temperature: body.temperature
  });

  if (!config.apiKey) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      error: "No API key configured. Set one in the browser UI or pass api_key in the request body."
    }));
    return;
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  const stream = body.stream !== false;
  const systemPrompt = body.system_prompt || body.systemPrompt || await loadSystemPrompt();

  if (systemPrompt && !messages.some(m => m.role === "system")) {
    messages.unshift({ role: "system", content: systemPrompt });
  }

  const upstreamBody = buildUpstreamRequest(messages, config, stream);
  const upstreamHeaders = buildUpstreamHeaders(config);

  try {
    const upstreamRes = await fetch(config.apiEndpoint, {
      method: "POST",
      headers: upstreamHeaders,
      body: JSON.stringify(upstreamBody)
    });

    if (!upstreamRes.ok) {
      const errorText = await upstreamRes.text().catch(() => "Unknown error");
      res.writeHead(upstreamRes.status, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        error: `Upstream API error (${upstreamRes.status}): ${errorText}`
      }));
      return;
    }

    if (stream) {
      await streamProxyResponse(upstreamRes, res);
    } else {
      await handleNonStreamingResponse(upstreamRes, res);
    }
  } catch (error) {
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      error: `Failed to reach upstream API: ${error.message}`
    }));
  }
}

export async function post(context) {
  await handleAgentChat(context);
}

export async function get(context) {
  const { res } = context;

  res.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8"
  });

  res.end(JSON.stringify({
    endpoint: "/api/agent_chat",
    method: "POST",
    description: "Send messages to the agent and get responses. Supports streaming (SSE) and non-streaming.",
    body: {
      messages: "Array of {role, content} messages (required)",
      stream: "Boolean, default true (optional)",
      model: "Override model (optional)",
      api_endpoint: "Override API endpoint (optional)",
      api_key: "Override API key (optional)",
      system_prompt: "Override system prompt (optional)",
      temperature: "Override temperature (optional)"
    },
    examples: {
      curl_stream: 'curl -N -X POST http://localhost:3000/api/agent_chat -H "Content-Type: application/json" -d \'{"messages":[{"role":"user","content":"Hello"}]}\'',
      curl_no_stream: 'curl -X POST http://localhost:3000/api/agent_chat -H "Content-Type: application/json" -d \'{"messages":[{"role":"user","content":"Hello"}],"stream":false}\''
    }
  }, null, 2));
}
