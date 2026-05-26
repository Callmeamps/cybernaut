# Cybernaut Project Tasks

- [x] Audit all test files for broken import paths (bead cybernaut-k1x)
- [x] Fix all stale import references (bead cybernaut-k1x)
- [x] Verify full test suite and fix failures (bead cybernaut-ope)
- [x] Add startup scripts for common tasks (bead cybernaut-bid)
- [x] Add project documentation (CLAUDE.md) and .env template (bead cybernaut-1cn)

## Remaining

- Browser integration tests (browser_address_bar, browser_window_persistence, etc.) need headless browser harness
- 3 unit tests (prompt_items, prompt_budget_trim, promptinclude) import via /mod/_core/... paths — need custom ESM loader or running server
- Consider adding `npm test` script to package.json
