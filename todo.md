# Cybernaut Project Tasks

## Complete
- [x] Audit all test files for broken import paths (bead cybernaut-k1x)
- [x] Fix all stale import references (bead cybernaut-k1x)
- [x] Verify full test suite and fix failures (bead cybernaut-ope)
- [x] Add startup scripts for common tasks (bead cybernaut-bid)
- [x] Add project documentation and .env template (bead cybernaut-1cn)
- [x] Add model list to agent settings — 24 curated models across 8 providers (bead cybernaut-h2t)
- [x] Add theme switching — dark/light/system with full CSS variable support (bead cybernaut-lxy)
- [x] Add character/persona selection — 6 characters with system prompt prefixes (bead cybernaut-ldl)
- [x] Remove Claude-specific branding — merge CLAUDE.md into AGENTS.md, diversify defaults

## Active
- [ ] Resolve browser review findings (5 issues from 2026-05-27 audit)
- [ ] CI setup for full test suite (needs Chromium for browser integration tests)

## Browser Review Findings (2026-05-27)
1. Headless browser can't click sidebar items (CSS visibility issue)
2. Onscreen agent avatar blocked by empty canvas overlay (z-index)
3. Login form submission doesn't complete (SCRAM flow)
4. Missing L2 user config files for fresh users
5. Demo spaces don't navigate visibly
