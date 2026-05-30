import assert from "node:assert/strict";
import { createHash, createHmac, pbkdf2Sync, randomBytes } from "node:crypto";
import test from "node:test";

import { createTestRuntime, cleanupTestRuntime, requestJson } from "./api_test_utils.mjs";
import {
  createProvisionedUserCryptoRecord,
  decodeBase64Url
} from "../server/pages/res/user-crypto.js";

function buildAuthMessage({ challengeToken, clientNonce, serverNonce, username }) {
  return ["space-login-v1", username, clientNonce, serverNonce, challengeToken].join(":");
}

function createClientProof({ challenge, clientNonce, password, username }) {
  const saltedPassword = pbkdf2Sync(
    password,
    Buffer.from(String(challenge.salt || ""), "base64url"),
    Number(challenge.iterations),
    32,
    "sha256"
  );
  const clientKey = createHmac("sha256", saltedPassword).update("Client Key").digest();
  const storedKey = createHash("sha256").update(clientKey).digest();
  const authMessage = buildAuthMessage({ challengeToken: challenge.challengeToken, clientNonce, serverNonce: challenge.serverNonce, username });
  const clientSignature = createHmac("sha256", storedKey).update(authMessage).digest();
  return Buffer.from(clientKey.map((byte, index) => byte ^ clientSignature[index])).toString("base64url");
}

async function createSession(runtime) {
  const guestRes = await requestJson(runtime.browserUrl, "/api/guest_create", {
    body: "{}",
    headers: { "content-type": "application/json" },
    method: "POST"
  });
  assert.equal(guestRes.status, 200);
  const { username, password } = guestRes.body;

  const nonce = randomBytes(18).toString("base64url");
  const challengeRes = await requestJson(runtime.browserUrl, "/api/login_challenge", {
    body: JSON.stringify({ clientNonce: nonce, username }),
    headers: { "content-type": "application/json" },
    method: "POST"
  });
  assert.equal(challengeRes.status, 200);
  const challenge = challengeRes.body;

  const userCryptoProvisioning = String(challenge.userCrypto?.state || "").trim() === "missing"
    ? { record: (await createProvisionedUserCryptoRecord({ password, serverShare: decodeBase64Url(challenge.userCrypto.provisioningShare) })).record }
    : undefined;

  const loginRes = await requestJson(runtime.browserUrl, "/api/login", {
    body: JSON.stringify({
      challengeToken: challenge.challengeToken,
      clientProof: createClientProof({ challenge, clientNonce: nonce, password, username }),
      userCryptoProvisioning
    }),
    headers: { "content-type": "application/json" },
    method: "POST"
  });
  assert.equal(loginRes.status, 200);

  const cookie = loginRes.headers.get("set-cookie") || "";
  return { cookie, username };
}

// --- file_copy ---

test("file_copy duplicates a file", async (testContext) => {
  const { runtime, customwarePath } = await createTestRuntime();
  testContext.after(async () => await cleanupTestRuntime(runtime, customwarePath));

  const { cookie } = await createSession(runtime);

  await requestJson(runtime.browserUrl, "/api/file_write", {
    body: JSON.stringify({ path: "~/original.txt", content: "copy me" }),
    headers: { "content-type": "application/json", cookie },
    method: "POST"
  });

  const copyRes = await requestJson(runtime.browserUrl, "/api/file_copy", {
    body: JSON.stringify({ fromPath: "~/original.txt", toPath: "~/copied.txt" }),
    headers: { "content-type": "application/json", cookie },
    method: "POST"
  });
  assert.equal(copyRes.status, 200);

  const readRes = await requestJson(runtime.browserUrl, `/api/file_read?path=~/copied.txt`, {
    headers: { cookie }
  });
  assert.equal(readRes.status, 200);
  assert.equal(readRes.body?.content, "copy me");
});

// --- file_move ---

test("file_move renames a file", async (testContext) => {
  const { runtime, customwarePath } = await createTestRuntime();
  testContext.after(async () => await cleanupTestRuntime(runtime, customwarePath));

  const { cookie } = await createSession(runtime);

  await requestJson(runtime.browserUrl, "/api/file_write", {
    body: JSON.stringify({ path: "~/before.txt", content: "move me" }),
    headers: { "content-type": "application/json", cookie },
    method: "POST"
  });

  const moveRes = await requestJson(runtime.browserUrl, "/api/file_move", {
    body: JSON.stringify({ fromPath: "~/before.txt", toPath: "~/after.txt" }),
    headers: { "content-type": "application/json", cookie },
    method: "POST"
  });
  assert.equal(moveRes.status, 200);

  // New location exists
  const readRes = await requestJson(runtime.browserUrl, `/api/file_read?path=~/after.txt`, {
    headers: { cookie }
  });
  assert.equal(readRes.status, 200);
  assert.equal(readRes.body?.content, "move me");

  // Old location gone
  const oldRes = await requestJson(runtime.browserUrl, `/api/file_read?path=~/before.txt`, {
    headers: { cookie }
  });
  assert.equal(oldRes.status, 404);
});

// --- file_paths ---

test("file_paths returns valid response shape", async (testContext) => {
  const { runtime, customwarePath } = await createTestRuntime();
  testContext.after(async () => await cleanupTestRuntime(runtime, customwarePath));

  const { cookie } = await createSession(runtime);

  // file_paths uses file index; just verify endpoint responds correctly
  const pathsRes = await requestJson(runtime.browserUrl, "/api/file_paths", {
    body: JSON.stringify({ patterns: ["~/*.txt"] }),
    headers: { "content-type": "application/json", cookie },
    method: "POST"
  });
  assert.equal(pathsRes.status, 200);
  assert.ok(pathsRes.body !== undefined);
  // Response should be object with pattern keys
  assert.ok(typeof pathsRes.body === "object");
});

// --- user_self_info ---

test("user_self_info returns current user", async (testContext) => {
  const { runtime, customwarePath } = await createTestRuntime();
  testContext.after(async () => await cleanupTestRuntime(runtime, customwarePath));

  const { cookie, username } = await createSession(runtime);

  const res = await requestJson(runtime.browserUrl, "/api/user_self_info", {
    headers: { cookie }
  });
  assert.equal(res.status, 200);
  assert.ok(res.body?.username);
  assert.equal(res.body.username, username);
});

// --- login_check ---

test("login_check returns auth status", async (testContext) => {
  const { runtime, customwarePath } = await createTestRuntime();
  testContext.after(async () => await cleanupTestRuntime(runtime, customwarePath));

  // Unauthenticated
  const unauthRes = await requestJson(runtime.browserUrl, "/api/login_check");
  assert.equal(unauthRes.status, 200);
  assert.equal(unauthRes.body?.authenticated, false);

  // Authenticated
  const { cookie } = await createSession(runtime);
  const authRes = await requestJson(runtime.browserUrl, "/api/login_check", {
    headers: { cookie }
  });
  assert.equal(authRes.status, 200);
  assert.equal(authRes.body?.authenticated, true);
});

// --- module_list ---

test("module_list returns available modules", async (testContext) => {
  const { runtime, customwarePath } = await createTestRuntime();
  testContext.after(async () => await cleanupTestRuntime(runtime, customwarePath));

  const { cookie } = await createSession(runtime);

  const res = await requestJson(runtime.browserUrl, "/api/module_list", {
    headers: { cookie }
  });
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body?.modules) || Array.isArray(res.body));
});

// --- module_info ---

test("module_info returns details for a module", async (testContext) => {
  const { runtime, customwarePath } = await createTestRuntime();
  testContext.after(async () => await cleanupTestRuntime(runtime, customwarePath));

  const { cookie } = await createSession(runtime);

  // First get the list to find a valid module name
  const listRes = await requestJson(runtime.browserUrl, "/api/module_list", {
    headers: { cookie }
  });
  assert.equal(listRes.status, 200);

  const modules = listRes.body?.modules || listRes.body;
  if (Array.isArray(modules) && modules.length > 0) {
    const moduleName = typeof modules[0] === "string" ? modules[0] : modules[0].name;
    const infoRes = await requestJson(runtime.browserUrl, `/api/module_info?name=${encodeURIComponent(moduleName)}`, {
      headers: { cookie }
    });
    assert.equal(infoRes.status, 200);
    assert.ok(infoRes.body);
  }
});

// --- extensions_load ---

test("extensions_load returns extensions for a context", async (testContext) => {
  const { runtime, customwarePath } = await createTestRuntime();
  testContext.after(async () => await cleanupTestRuntime(runtime, customwarePath));

  const { cookie } = await createSession(runtime);

  const res = await requestJson(runtime.browserUrl, "/api/extensions_load", {
    body: JSON.stringify({ context: "default" }),
    headers: { "content-type": "application/json", cookie },
    method: "POST"
  });
  assert.equal(res.status, 200);
  assert.ok(res.body !== undefined);
});

// --- agent_chat (basic shape) ---

test("agent_chat rejects unauthenticated requests", async (testContext) => {
  const { runtime, customwarePath } = await createTestRuntime();
  testContext.after(async () => await cleanupTestRuntime(runtime, customwarePath));

  const res = await requestJson(runtime.browserUrl, "/api/agent_chat", {
    body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }),
    headers: { "content-type": "application/json" },
    method: "POST"
  });
  assert.ok(res.status === 401 || res.status === 403);
});
