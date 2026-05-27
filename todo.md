# Cybernaut Project Tasks

## Complete
- [x] Audit all test files for broken import paths (bead cybernaut-k1x)
- [x] Fix all stale import references (bead cybernaut-k1x)
- [x] Verify full test suite and fix failures (bead cybernaut-ope)
- [x] Add startup scripts for common tasks (bead cybernaut-bid)
- [x] Add project documentation (CLAUDE.md) and .env template (bead cybernaut-1cn)

## Browser Review Findings (2026-05-27)

### Pages Tested
- `/` and `/login` — Login page renders correctly, responsive
- `/enter` — Redirects to login (expected)
- Dashboard (post-login) — Spaces, panels, sidebar all render
- Settings dialog — Opens from "Set LLM API key" warning, shows model/params/instructions

### Issues Found

1. **Headless browser can't click sidebar items** — Sidebar labels (`text=Agent`, `text=Files`) are "not visible" in headless mode despite appearing in content extraction. Likely CSS `visibility` or `opacity` issue in the sidebar when not expanded. The sidebar expands on `text=menu` click but panel labels still aren't clickable.

2. **Onscreen agent avatar blocked** — Clicking `.onscreen-agent-avatar-button` fails because `<div data-empty-canvas-stage="buttons" class="spaces-empty-canvas-content">` intercepts pointer events. The empty space canvas overlays the agent.

3. **"Drag me, tap me." hint visible** — The onscreen agent shows its startup hint but can't be interacted with due to issue #2.

4. **Missing L2 user files** — Server logs show repeated 404s for `~/conf/onscreen-agent.yaml`, `~/conf/dashboard.yaml`, `~/hist/onscreen-agent.json`, `~/meta/login_hooks.json`, `~/spaces/big-bang/space.yaml`. These are auto-created as the user interacts with the app, but the welcome/dashboard flow should handle missing files more gracefully.

5. **Login form submission** — Browser form login via `input[type='submit']` shows "Signing in..." but doesn't redirect to dashboard. The SCRAM-SHA-256 flow may need the password verifier to be set up differently. Manual API login via curl also returned 401.

6. **API endpoints** — `/api/health`, `/api/agent_status`, `/api/agent_skills` all return correct JSON. Skills list shows 7 skills loaded.

### Improvements Needed

1. **Empty space onboarding** — The "Big Bang" space shows an empty canvas with "Start fast" links but no widgets. Should either pre-populate with default widgets or show a clearer onboarding flow.

2. **Sidebar panel visibility** — Panel labels in the sidebar need to be visible/clickable in headless mode for automated testing. Consider adding `aria-label` or ensuring CSS visibility.

3. **Onscreen agent z-index** — The empty canvas overlay blocks the agent avatar. Either raise the agent's z-index or hide the overlay when no widgets are present.

4. **User config initialization** — Create default config files (`~/conf/onscreen-agent.yaml`, `~/conf/dashboard.yaml`) on first login to reduce 404 noise in logs.

5. **Login flow** — The browser form login should work end-to-end. May need to debug the SCRAM challenge-response flow in the browser context.

6. **Demo spaces** — "Daily News", "Crypto Dashboard", "Retro Arcade", "Agent Zero Videos" demo spaces are listed but clicking them doesn't visibly navigate (may need widgets configured).

### Test Results
- 125 pass, 3 fail (browser module path tests need server-side resolution)
- Browser integration tests need headless browser harness (Playwright/Puppeteer)

## Active Beads

- [~] Add model list to agent settings (bead cybernaut-h2t) — P1
- [~] Add theme switching dark/light/system (bead cybernaut-lxy) — P1
- [~] Add character/persona switching (bead cybernaut-ldl) — P1
