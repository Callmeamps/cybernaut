# Agent Instructions

This project uses **bd (beads)** for issue tracking. Run `bd prime` for full workflow context.

## Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work atomically
bd close <id>         # Complete work
bd dolt push          # Push beads data to remote
```

## Non-Interactive Shell Commands

**ALWAYS use non-interactive flags** with file operations to avoid hanging on confirmation prompts.

Shell commands like `cp`, `mv`, and `rm` may be aliased to include `-i` (interactive) mode on some systems, causing the agent to hang indefinitely waiting for y/n input.

**Use these forms instead:**
```bash
# Force overwrite without prompting
cp -f source dest           # NOT: cp source dest
mv -f source dest           # NOT: mv source dest
rm -f file                  # NOT: rm file

# For recursive operations
rm -rf directory            # NOT: rm -r directory
cp -rf source dest          # NOT: cp -r source
```

**Other commands that may prompt:**
- `scp` - use `-o BatchMode=yes` for non-interactive
- `ssh` - use `-o BatchMode=yes` to fail instead of prompting
- `apt-get` - use `-y` flag
- `brew` - use `HOMEBREW_NO_AUTO_UPDATE=1` env var

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:ca08a54f -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd dolt push
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->

## Build & Test

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run a specific test file
node --loader ./tests/import_map_loader.mjs --test tests/yaml_lite_test.mjs

# Run tests matching a pattern
node --loader ./tests/import_map_loader.mjs --test tests/*login*.mjs

# Start the server
node space serve

# Start with custom port
node space serve --port 8080

# Full setup (install + create user + start)
SPACE_INITIAL_PASSWORD=secret ./setup.sh --user admin
```

## Scripts

Reusable helper scripts in `.bash_scripts/`:

```bash
.bash_scripts/start-server [port]     # Start dev server (default 3000)
.bash_scripts/run-tests [all|pattern] # Run tests (unit by default, all for full suite)
.bash_scripts/audit                   # Repo health: beads, tests, recent commits
```

## Architecture Overview

**Cybernaut** is a browser-first AI agent runtime. The agent lives in the browser and can build tools, browse the web, and execute code. A thin Node.js server handles auth, file operations, and routing.

### Layers

```
┌─────────────────────────────────────────────┐
│  Browser (Alpine.js + ES modules)           │
│  app/L0/_all/mod/_core/                     │
│    framework/  — JS/CSS runtime, Alpine     │
│    onscreen_agent/ — chat UI, LLM calls     │
│    agent/      — agent panel                │
│    huggingface/ — local LLM inference       │
│    skillset/   — skill definitions (SKILL.md)│
│    router/     — page routing               │
│    user/       — user management             │
│    dashboard/  — dashboard view              │
│    visual/     — icons, CSS, assets         │
└─────────────────────────────────────────────┘
                      ↕ REST API
┌─────────────────────────────────────────────┐
│  Node.js Server                             │
│  server/                                    │
│    server.js   — entry point, cluster mode  │
│    app.js      — Express-like app bootstrap │
│    router/     — request routing, CORS      │
│    api/        — REST endpoints (/api/*)     │
│    lib/        — business logic             │
│      auth/     — SCRAM-SHA-256 auth, keys   │
│      customware/ — file access, modules     │
│      file_watch/ — watchdog, file indexing  │
│      rate_limit.js — LLM API rate limiting  │
│      tmp/      — temp file management       │
│    jobs/       — background job runner      │
│    runtime/    — cluster, state system      │
│    pages/      — server-rendered pages      │
└─────────────────────────────────────────────┘
```

### Key Patterns

- **No build step**: ES modules served directly. No bundler, no transpiler.
- **Extension system**: `<x-extension>` HTML seams + `space.extend()` JS hooks for composition.
- **Alpine.js**: Lightweight reactivity for the UI.
- **Customware**: Per-user file system under `app/L2/<username>/`. L0 = system, L1 = groups, L2 = users.
- **Skills**: SKILL.md files in `skillset/ext/skills/` define agent capabilities. Skills auto-load based on `<x-context>` tags.
- **Auth**: SCRAM-SHA-256 challenge-response, 310k iterations. Passwords sealed with AES-256-GCM.
- **Rate limiting**: 60 req/min per user on LLM API calls.
- **Cluster mode**: Multi-worker via `server/runtime/cluster.js`. State synchronized through watchdog.

### API Endpoints

All under `/api/`:
- `agent_chat` — streaming/non-streaming LLM chat
- `agent_status` — agent status check
- `agent_skills` — list available skills
- `file_read/write/list/delete/copy/move/info/paths` — file operations
- `login/login_challenge/login_check` — auth flow
- `user_crypto_bootstrap/user_crypto_session_key` — crypto key exchange
- `user_self_info` — current user info
- `module_info/module_list` — module discovery
- `extensions_load` — load extensions
- `health` — health check

### CLI Commands

```bash
node space serve         # Start server
node space help          # Show help
node space version       # Show version
```

## Conventions & Patterns

### Code Style
- ES modules (`.js`, `.mjs`). No CommonJS except where Node APIs require it.
- `snake_case` for file names, `camelCase` for JS variables/functions.
- No linter configured yet. Match existing style in each file.

### File Naming
- Server API: `server/api/<name>.js` — each exports `{ handlers: { GET, POST, ... } }`
- Browser modules: `app/L0/_all/mod/_core/<module>/` — each has `view.html`, `store.js`, etc.
- Skills: `app/L0/_all/mod/_core/skillset/ext/skills/<name>/SKILL.md`
- Tests: `tests/<name>_test.mjs`

### Testing
- Tests use Node built-in `node:test` + `node:assert`.
- ESM format (`.mjs`).
- Unit tests should be fast and not require external services.
- Integration tests (cluster, browser harness) may need special environment.

### Git
- Conventional Commits: `feat:`, `fix:`, `chore:`, `test:`, `docs:`, `refactor:`
- Branch: `main`
- Remote: `https://github.com/Callmeamps/cybernaut.git`

### Security
- Never commit `.env` (contains secrets).
- Never commit `app/L2/` (user data).
- Auth keys file created atomically with `0600` permissions.
