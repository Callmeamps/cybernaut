# Space Agent Lite

A lean, mobile-friendly AI agent runtime. Fork of [space-agent](https://github.com/agent0ai/space-agent).

The agent lives in your browser and can build tools, browse the web, and execute code on the fly. Connect it to any OpenAI-compatible API (OpenRouter, OpenAI, local Ollama, etc).

## Quick Start

```bash
./setup.sh --user admin --pass mypassword
```

This installs dependencies, creates your account, and starts the server. Then open `http://localhost:3000` in your browser.

### Manual setup

```bash
npm install
node space serve
```

Open `http://localhost:3000` and create your account through the browser UI.

## Setup Script

```bash
./setup.sh --user alice --pass secret       # create user + start
./setup.sh --user alice --pass secret --port 8080 --host 0.0.0.0  # custom port
./setup.sh --start                          # just start (user already exists)
./setup.sh --no-start --no-install          # just create user
```

## Configuration

Edit `.env` in the project root:

```bash
PORT=3000
HOST=127.0.0.1
SINGLE_USER_APP=true
```

Agent settings (API key, model, endpoint) are configured in the browser UI under Settings.

## Agent API

Connect external coding agents (Claude, GPT, Cursor, etc.) via the REST API:

```bash
# Check agent status
curl http://localhost:3000/api/agent_status

# Send a message (streaming)
curl -N -X POST http://localhost:3000/api/agent_chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello"}]}'

# Send a message (non-streaming)
curl -X POST http://localhost:3000/api/agent_chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello"}],"stream":false}'

# Override model or endpoint per request
curl -N -X POST http://localhost:3000/api/agent_chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello"}],"model":"gpt-4o","api_key":"sk-..."}'

# List available skills
curl http://localhost:3000/api/agent_skills
```

## Architecture

- **Browser-first**: The app is a browser runtime. The server is thin infrastructure.
- **No build step**: ES modules served directly. No bundler, no transpiler.
- **Alpine.js**: Lightweight reactivity for the UI.
- **Extension system**: `<x-extension>` HTML seams and `space.extend()` JS hooks for composition.
- **Mobile-friendly**: Responsive CSS with full-screen chat on phones, 44px touch targets, safe-area support.

## Project Structure

```
space-agent-lite/
  setup.sh                 Setup script (install + user creation)
  space, space.js          CLI entry point
  app/L0/_all/mod/_core/   Browser modules (framework, agent, visual, skills)
  server/                  Node.js server (API, auth, routing)
  commands/                CLI commands (serve, help, version)
```

## License

MIT
