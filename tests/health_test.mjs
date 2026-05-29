import assert from "node:assert/strict";
import test from "node:test";
import { createTestRuntime, cleanupTestRuntime, requestJson } from "./api_test_utils.mjs";

test("health returns ok", async (testContext) => {
  const { runtime, customwarePath } = await createTestRuntime();
  testContext.after(async () => await cleanupTestRuntime(runtime, customwarePath));

  const res = await requestJson(runtime.browserUrl, "/api/health");
  assert.equal(res.status, 200);
  assert.equal(res.body?.ok, true);
});
