import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");

const PREFIX_MAP = [
  ["/mod/", path.join(PROJECT_ROOT, "app/L0/_all/mod/")]
];

export function resolve(specifier, context, nextResolve) {
  for (const [prefix, targetDir] of PREFIX_MAP) {
    if (specifier.startsWith(prefix)) {
      const relativePath = specifier.slice(prefix.length);
      const resolvedPath = path.join(targetDir, relativePath);
      return nextResolve(pathToFileURL(resolvedPath).href, context);
    }
  }

  return nextResolve(specifier, context);
}
