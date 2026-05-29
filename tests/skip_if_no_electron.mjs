import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export function isElectronAvailable() {
  try {
    const { PROJECT_ROOT, loadPackagingDependency } = require("../packaging/scripts/tooling.js");
    loadPackagingDependency("electron");
    return true;
  } catch {
    return false;
  }
}
