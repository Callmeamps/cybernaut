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

  // SCRAM login
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

test("file_write creates a file and file_read returns it", async (testContext) => {
  const { runtime, customwarePath } = await createTestRuntime();
  testContext.after(async () => await cleanupTestRuntime(runtime, customwarePath));

  const { cookie } = await createSession(runtime);

  const writeRes = await requestJson(runtime.browserUrl, "/api/file_write", {
    body: JSON.stringify({ path: "~/hello.txt", content: "hello world", encoding: "utf8" }),
    headers: { "content-type": "application/json", cookie },
    method: "POST"
  });
  assert.equal(writeRes.status, 200);
  assert.ok(writeRes.body?.path);
  assert.match(writeRes.body.path, /hello\.txt$/);

  const readRes = await requestJson(runtime.browserUrl, `/api/file_read?path=~/hello.txt`, {
    headers: { cookie }
  });
  assert.equal(readRes.status, 200);
  assert.equal(readRes.body?.content, "hello world");
});

test("file_list returns directory contents", async (testContext) => {
  const { runtime, customwarePath } = await createTestRuntime();
  testContext.after(async () => await cleanupTestRuntime(runtime, customwarePath));

  const { cookie } = await createSession(runtime);

  await requestJson(runtime.browserUrl, "/api/file_write", {
    body: JSON.stringify({ path: "~/testfile.txt", content: "test" }),
    headers: { "content-type": "application/json", cookie },
    method: "POST"
  });

  const listRes = await requestJson(runtime.browserUrl, "/api/file_list", {
    body: JSON.stringify({ path: "~/", recursive: false }),
    headers: { "content-type": "application/json", cookie },
    method: "POST"
  });
  assert.equal(listRes.status, 200);
  assert.ok(Array.isArray(listRes.body?.paths) || Array.isArray(listRes.body?.files) || Array.isArray(listRes.body?.entries));
  const names = (listRes.body?.paths || listRes.body?.files || listRes.body?.entries || []).map(f => typeof f === "string" ? f : (f.name || f.path || ""));
  assert.ok(names.some(n => n && n.includes("testfile")), `testfile not found in listing: ${JSON.stringify(names)}`);
});

test("file_delete removes a file", async (testContext) => {
  const { runtime, customwarePath } = await createTestRuntime();
  testContext.after(async () => await cleanupTestRuntime(runtime, customwarePath));

  const { cookie, username } = await createSession(runtime);

  await requestJson(runtime.browserUrl, "/api/file_write", {
    body: JSON.stringify({ path: "~/deleteme.txt", content: "gone soon" }),
    headers: { "content-type": "application/json", cookie },
    method: "POST"
  });

  const delRes = await requestJson(runtime.browserUrl, "/api/file_delete", {
    body: JSON.stringify({ path: "~/deleteme.txt" }),
    headers: { "content-type": "application/json", cookie },
    method: "POST"
  });
  assert.equal(delRes.status, 200);

  // Verify it's gone
  const readRes = await requestJson(runtime.browserUrl, `/api/file_read?path=~/deleteme.txt`, {
    headers: { cookie }
  });
  assert.equal(readRes.status, 404);
});

test("file_info returns metadata", async (testContext) => {
  const { runtime, customwarePath } = await createTestRuntime();
  testContext.after(async () => await cleanupTestRuntime(runtime, customwarePath));

  const { cookie } = await createSession(runtime);

  await requestJson(runtime.browserUrl, "/api/file_write", {
    body: JSON.stringify({ path: "~/infofile.txt", content: "info please" }),
    headers: { "content-type": "application/json", cookie },
    method: "POST"
  });

  const infoRes = await requestJson(runtime.browserUrl, `/api/file_info?path=~/infofile.txt`, {
    headers: { cookie }
  });
  assert.equal(infoRes.status, 200);
  assert.ok(infoRes.body?.path);
  assert.ok(infoRes.body?.size !== undefined);
});
