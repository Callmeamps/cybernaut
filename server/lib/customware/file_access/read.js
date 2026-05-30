import fs from "node:fs";
import path from "node:path";

import {
  createHttpError,
  isPlainObject,
  stripTrailingSlash,
  getPathIndex,
  getGroupIndex,
  createAbsolutePath,
  toAppRelativePath,
  toAppRelativeProjectPath,
  normalizeFilePathPattern,
  normalizeAccessMode,
  normalizeAppProjectPath
} from "./_shared.js";

import {
  resolveUserShorthandPath,
  resolveExistingProjectPath
} from "./path_resolution.js";

import {
  createAppAccessController,
  ensureReadableProjectPath,
  ensurePublicAppProjectPath
} from "./permission_check.js";

function ensureValidReadEncoding(encoding) {
  if (encoding === "utf8" || encoding === "base64") {
    return encoding;
  }
  throw createHttpError(`Unsupported read encoding: ${String(encoding || "")}`, 400);
}

function normalizeReadEntries(options = {}) {
  if (Array.isArray(options.files)) {
    if (options.files.length === 0) {
      throw createHttpError("File read batch must not be empty.", 400);
    }
    return options.files;
  }
  if ("files" in options) {
    throw createHttpError("File read batch must provide a files array.", 400);
  }
  return [{ encoding: options.encoding, path: options.path }];
}

function normalizeReadRequests(options = {}) {
  const pathIndex = getPathIndex(options.watchdog);
  const accessController = createAppAccessController({
    groupIndex: getGroupIndex(options.watchdog, options.runtimeParams),
    runtimeParams: options.runtimeParams,
    username: options.username
  });
  const entries = normalizeReadEntries(options);

  return entries.map((entry) => {
    const request = isPlainObject(entry) ? entry : { path: entry };
    const requestedPath = String(request.path || "").trim();
    if (!requestedPath) {
      throw createHttpError("File path must not be empty.", 400);
    }
    const resolvedPath = resolveExistingProjectPath(
      pathIndex,
      resolveUserShorthandPath(requestedPath, accessController.username)
    );
    if (!resolvedPath.projectPath || !resolvedPath.exists) {
      throw createHttpError(`File not found: ${requestedPath}`, 404);
    }
    if (resolvedPath.isDirectory) {
      throw createHttpError(`Expected a file path: ${requestedPath}`, 400);
    }
    ensurePublicAppProjectPath(resolvedPath.projectPath);
    ensureReadableProjectPath(resolvedPath.projectPath, accessController);
    return {
      absolutePath: createAbsolutePath(String(options.projectRoot || ""), resolvedPath.projectPath, options.runtimeParams),
      encoding: ensureValidReadEncoding(String(request.encoding || options.encoding || "utf8").toLowerCase()),
      path: toAppRelativePath(resolvedPath.projectPath)
    };
  });
}

function readAppFiles(options = {}) {
  const requests = normalizeReadRequests(options);
  const files = requests.map((request) => {
    const buffer = fs.readFileSync(request.absolutePath);
    return {
      content: request.encoding === "base64" ? buffer.toString("base64") : buffer.toString("utf8"),
      encoding: request.encoding,
      path: request.path
    };
  });
  return { count: files.length, files };
}

function readAppFile(options = {}) {
  return readAppFiles(options).files[0];
}

function resolveReadableExistingAppPath(options = {}) {
  const pathIndex = getPathIndex(options.watchdog);
  const accessController = createAppAccessController({
    groupIndex: getGroupIndex(options.watchdog, options.runtimeParams),
    runtimeParams: options.runtimeParams,
    username: options.username
  });
  const requestedPath = String(options.path || "").trim();

  if (!requestedPath) {
    throw createHttpError("Path must not be empty.", 400);
  }
  const resolvedPath = resolveExistingProjectPath(
    pathIndex,
    resolveUserShorthandPath(requestedPath, accessController.username)
  );
  if (!resolvedPath.projectPath || !resolvedPath.exists) {
    throw createHttpError(`Path not found: ${requestedPath}`, 404);
  }
  if (options.expectedKind === "directory" && !resolvedPath.isDirectory) {
    throw createHttpError(`Expected a folder path: ${requestedPath}`, 400);
  }
  if (options.expectedKind === "file" && resolvedPath.isDirectory) {
    throw createHttpError(`Expected a file path: ${requestedPath}`, 400);
  }
  ensurePublicAppProjectPath(resolvedPath.projectPath);
  ensureReadableProjectPath(resolvedPath.projectPath, accessController);
  return {
    absolutePath: createAbsolutePath(String(options.projectRoot || ""), resolvedPath.projectPath, options.runtimeParams),
    isDirectory: resolvedPath.isDirectory,
    path: toAppRelativePath(resolvedPath.projectPath),
    projectPath: resolvedPath.projectPath,
    requestedPath
  };
}

function getAppPathInfo(options = {}) {
  const resolvedPath = resolveReadableExistingAppPath(options);
  const stats = fs.statSync(resolvedPath.absolutePath);
  return {
    isDirectory: stats.isDirectory(),
    modifiedAt: stats.mtime.toISOString(),
    path: resolvedPath.path,
    size: Number(stats.size) || 0
  };
}

function getAppFolderDownloadInfo(options = {}) {
  const resolvedPath = resolveReadableExistingAppPath({ ...options, expectedKind: "directory" });
  return {
    absolutePath: resolvedPath.absolutePath,
    directoryName:
      path.basename(stripTrailingSlash(resolvedPath.absolutePath)) ||
      path.basename(stripTrailingSlash(resolvedPath.path)) ||
      "download",
    path: resolvedPath.path
  };
}

export {
  getAppFolderDownloadInfo,
  getAppPathInfo,
  readAppFile,
  readAppFiles
};
