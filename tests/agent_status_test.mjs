import assert from "node:assert/strict";
import test from "node:test";
import { createTestRuntime, cleanupTestRuntime, requestJson } from "./api_test_utils.mjs";

test("agent_status returns ok", async (testContext) => {
  const { runtime, customwarePath } = await createTestRuntime();
  testContext.after(async () => await cleanupTestRuntime(runtime, customwarePath));

  const res = await requestJson(runtime.browserUrl, "/api/agent_status");
  assert.equal(res.status, 200);
  assert.equal(res.body?.ok, true);
  assert.equal(res.body?.agent?.runtime, "browser-first");
});

test("agent_status returns endpoint map", async (testContext) => {
  const { runtime, customwarePath } = await createTestRuntime();
  testContext.after(async () => await cleanupTestRuntime(runtime, customwarePath));

  const res = await requestJson(runtime.browserUrl, "/api/agent_status");
  assert.equal(res.status, 200);
  assert.ok(res.body?.endpoints?.chat);
  assert.ok(res.body?.endpoints?.status);
  assert.ok(res.body?.endpoints?.health);
});
