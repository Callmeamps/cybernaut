import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { startServer } from "../server/server.js";

export async function createTestRuntime(overrides = {}) {
  const customwarePath = await fs.mkdtemp(path.join(os.tmpdir(), "space-test-"));
  const runtime = await startServer({
    runtimeParamOverrides: {
      HOST: "127.0.0.1",
      PORT: "0",
      WORKERS: "1",
      ALLOW_GUEST_USERS: "true",
      CUSTOMWARE_PATH: customwarePath,
      ...overrides
    }
  });
  return { runtime, customwarePath };
}

export async function cleanupTestRuntime(runtime, customwarePath) {
  await runtime.close();
  await fs.rm(customwarePath, { force: true, recursive: true });
}

export async function requestJson(baseUrl, pathname, options = {}) {
  const response = await fetch(new URL(pathname, baseUrl), {
    body: options.body,
    headers: options.headers,
    method: options.method || "GET"
  });
  const bodyText = await response.text();
  return {
    body: bodyText ? JSON.parse(bodyText) : null,
    headers: response.headers,
    status: response.status
  };
}
