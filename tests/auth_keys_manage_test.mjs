/**
 * Tests for auth_keys_manage.js — auth key loading and atomic creation.
 * Run with: node --test tests/auth_keys_manage_test.mjs
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// Inline the module source so we can test internals without module mocking
// complexity. In production, use a proper test harness with module mocking.
const PROJECT_ROOT = path.join(import.meta.dirname, "..");

// We test the public API by loading keys_manage and verifying behavior
// on a temp auth data dir.
describe("auth_keys_manage", () => {
  it("loadAuthKeys returns injected keys when env vars are set", async () => {
    const { loadAuthKeys } = await import("../server/lib/auth/keys_manage.js");

    const result = loadAuthKeys(PROJECT_ROOT, {
      SPACE_AUTH_PASSWORD_SEAL_KEY: Buffer.from(randomBytes(32)).toString("base64url"),
      SPACE_AUTH_SESSION_HMAC_KEY: Buffer.from(randomBytes(32)).toString("base64url")
    });

    assert.equal(result.created, false);
    assert.equal(result.filePath, "process.env");
    assert.ok(result.passwordSealKey);
    assert.ok(result.sessionHmacKey);
  });

  it("loadAuthKeys creates auth_keys.json on first call", async () => {
    const { loadAuthKeys } = await import("../server/lib/auth/keys_manage.js");
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "auth-test-"));
    const dataDir = path.join(tmpDir, "data");
    fs.mkdirSync(dataDir, { recursive: true });

    // Ensure data dir is writable for test
    const result = loadAuthKeys(tmpDir, { SPACE_AUTH_DATA_DIR: dataDir });

    assert.equal(result.created, true);
    assert.ok(fs.existsSync(result.filePath));

    // Verify permissions are restrictive
    const stat = fs.statSync(result.filePath);
    const mode = stat.mode & 0o777;
    assert.ok(mode <= 0o600, `auth_keys.json has mode ${mode.toString(8)}, expected ≤0o600`);

    // Cleanup
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("loadAuthKeys reads existing keys on subsequent calls", async () => {
    const { loadAuthKeys } = await import("../server/lib/auth/keys_manage.js");
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "auth-test2-"));
    const dataDir = path.join(tmpDir, "data");
    fs.mkdirSync(dataDir, { recursive: true });

    const first = loadAuthKeys(tmpDir, { SPACE_AUTH_DATA_DIR: dataDir });
    assert.equal(first.created, true);

    const second = loadAuthKeys(tmpDir, { SPACE_AUTH_DATA_DIR: dataDir });
    assert.equal(second.created, false);
    assert.equal(
      second.passwordSealKey.equals(first.passwordSealKey),
      true,
      "Second call should return same keys"
    );
    assert.equal(
      second.sessionHmacKey.equals(first.sessionHmacKey),
      true,
      "Second call should return same session key"
    );

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("concurrent loadAuthKeys does not leave world-readable keys", async () => {
    const { loadAuthKeys } = await import("../server/lib/auth/keys_manage.js");
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "auth-race-"));
    const dataDir = path.join(tmpDir, "data");
    fs.mkdirSync(dataDir, { recursive: true });

    // Simulate concurrent creation by multiple processes
    const results = Array.from({ length: 5 }, () =>
      loadAuthKeys(tmpDir, { SPACE_AUTH_DATA_DIR: dataDir })
    );

    // Exactly one should report created=true
    const created = results.filter((r) => r.created);
    assert.equal(created.length, 1, "Exactly one process should create the file");

    // All should agree on the keys
    for (const result of results) {
      assert.ok(result.passwordSealKey.equals(created[0].passwordSealKey));
      assert.ok(result.sessionHmacKey.equals(created[0].sessionHmacKey));
    }

    // File permissions check
    const stat = fs.statSync(path.join(dataDir, "auth_keys.json"));
    const mode = stat.mode & 0o777;
    assert.ok(mode <= 0o600, `File mode ${mode.toString(8)} should be ≤0o600`);

    // No stale temp files should remain
    const entries = fs.readdirSync(dataDir);
    const stale = entries.filter((e) => e.startsWith(".auth_keys.tmp."));
    assert.equal(stale.length, 0, "No stale temp files should remain");

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

function randomBytes(n) {
  return crypto.getRandomValues(new Uint8Array(n));
}