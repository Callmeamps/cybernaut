/**
 * File access facade.
 * Extracted into sub-modules to enable unit testing:
 *   _shared.js         — core helpers, path-index, quota, pattern utilities
 *   path_resolution.js — path resolution and tree traversal
 *   permission_check.js — access control and owner-scope helpers
 *
 * This facade re-exports all symbols for backward compatibility.
 */

import fs from "node:fs";
import path from "node:path";

// ─── Import helpers for local use ──────────────────────────────────────────

import {
  createHttpError,
  isPlainObject,
  stripTrailingSlash,
  getPathIndex,
  getSortedProjectPaths,
  getGroupIndex,
  hasPath,
  hasExistingProjectPathConflict,
  createAbsolutePath,
  hasFileIndexStateSystem,
  toAppRelativePath,
  toAppRelativeProjectPath,
  getParentDirectoryProjectPath,
  isDescendantPath,
  isSameOrDescendantPath,
  isReservedIndexedProjectPath,
  normalizeFilePathPattern,
  compileFilePathPatterns,
  normalizeAccessMode,
  listReadableGroupIds,
  createReadableOwnerScopes,
  getFileIndexShardIdForOwnerRoot,
  isOwnerRootWithinMaxLayer,
  findOwnerScope,
  addPatternMatchesForPath,
  createQuotaPlan,
  invalidateQuotaDeltas,
  getIndexedOrAbsolutePathSize,
  getWriteQuotaDeltas,
  getCopyQuotaDeltas,
  getMoveQuotaDeltas,
  getDeleteQuotaDeltas,
  getSortedShardProjectPaths,
  listAppPathsByPatternsFromFileIndex,
  FILE_INDEX_AREA,
  isReservedAppProjectPath,
  normalizeAppProjectPath,
  normalizeEntityId,
  parseAppProjectPath,
  resolveProjectAbsolutePath,
  createRuntimeGroupIndex,
  getRuntimeGroupIndex,
  getFileIndexShardValue,
  listStateAreaIds,
  applyUserFolderQuotaPlan,
  createUserFolderQuotaPlan,
  getIndexedProjectPathSize,
  invalidateUserFolderSizeCacheForProjectPaths,
  readAbsolutePathSize,
  createEmptyGroupIndex,
  globToRegExp,
  normalizePathSegment,
  isProjectPathWithinMaxLayer,
  normalizeMaxLayer
} from "./file_access/_shared.js";

import {
  resolveUserShorthandPath,
  resolveExistingProjectPath
} from "./file_access/path_resolution.js";

import {
  createAppAccessController,
  ensureReadableProjectPath,
  ensureWritableProjectPath,
  ensurePublicAppProjectPath,
  canAccessProjectPath,
  ensureProjectPathAccess,
  createReadableOwnerScopesFromGroupIndex,
  createWritableOwnerScopesFromState,
  createWritableOwnerScopesFromWatchdog
} from "./file_access/permission_check.js";

import {
  listLayerHistoryRepositories,
  recordAppPathMutations
} from "./git_history.js";

// ─── High-level operations (remain in this file until fully extracted) ─────────

// ── Read operations ──────────────────────────────────────────────────────────

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

// ── Write operations ──────────────────────────────────────────────────────────

function getExplicitWriteField(request, options, key) {
  if (isPlainObject(request) && Object.prototype.hasOwnProperty.call(request, key)) {
    return request[key];
  }
  if (Object.prototype.hasOwnProperty.call(options, key)) {
    return options[key];
  }
  return undefined;
}

function ensureValidWriteOperation(operation) {
  const normalizedOperation = String(operation || "replace").trim().toLowerCase();
  if (!normalizedOperation || normalizedOperation === "replace") {
    return "replace";
  }
  if (normalizedOperation === "append" || normalizedOperation === "prepend" || normalizedOperation === "insert") {
    return normalizedOperation;
  }
  throw createHttpError("Unsupported write operation: " + String(operation || ""), 400);
}

function normalizeWriteInsertTarget(request, options, operation, requestedPath) {
  const rawLine = getExplicitWriteField(request, options, "line");
  const rawBefore = getExplicitWriteField(request, options, "before");
  const rawAfter = getExplicitWriteField(request, options, "after");
  const targetCount = Number(rawLine !== undefined) + Number(rawBefore !== undefined) + Number(rawAfter !== undefined);

  if (operation !== "insert") {
    if (targetCount > 0) {
      throw createHttpError("Write operation " + operation + " does not accept line, before, or after: " + requestedPath, 400);
    }
    return null;
  }

  if (targetCount !== 1) {
    throw createHttpError("Insert writes require exactly one of line, before, or after: " + requestedPath, 400);
  }

  if (rawLine !== undefined) {
    const line = Number(rawLine);
    if (!Number.isInteger(line) || line < 1) {
      throw createHttpError("Insert line must be a positive integer: " + requestedPath, 400);
    }
    return { type: "line", line };
  }

  if (rawBefore !== undefined) {
    const pattern = String(rawBefore ?? "");
    if (!pattern) {
      throw createHttpError("Insert before pattern must not be empty: " + requestedPath, 400);
    }
    return { type: "before", pattern };
  }

  const pattern = String(rawAfter ?? "");
  if (!pattern) {
    throw createHttpError("Insert after pattern must not be empty: " + requestedPath, 400);
  }
  return { type: "after", pattern };
}

function createLineInsertOffsets(content) {
  const offsets = [0];
  for (let index = 0; index < content.length; index += 1) {
    if (content[index] === "\n") {
      offsets.push(index + 1);
    }
  }
  if (offsets[offsets.length - 1] !== content.length) {
    offsets.push(content.length);
  }
  return offsets;
}

function resolveTextInsertOffset(existingText, insertTarget, requestedPath) {
  if (insertTarget?.type === "line") {
    const offsets = createLineInsertOffsets(existingText);
    if (insertTarget.line > offsets.length) {
      throw createHttpError("Insert line " + insertTarget.line + " is out of range: " + requestedPath, 400);
    }
    return offsets[insertTarget.line - 1];
  }
  const pattern = String(insertTarget?.pattern || "");
  const matchIndex = existingText.indexOf(pattern);
  if (matchIndex === -1) {
    throw createHttpError("Insert pattern not found: " + requestedPath, 404);
  }
  return insertTarget.type === "after" ? matchIndex + pattern.length : matchIndex;
}

function readExistingWriteBuffer(absolutePath, requestedPath) {
  if (!fs.existsSync(absolutePath)) {
    return Buffer.alloc(0);
  }
  const stats = fs.statSync(absolutePath);
  if (stats.isDirectory()) {
    throw createHttpError("Expected a file path: " + requestedPath, 400);
  }
  return fs.readFileSync(absolutePath);
}

function buildWriteBuffer(options = {}) {
  const encoding = options.encoding || "utf8";
  const operation = options.operation || "replace";
  const nextContent = String(options.content ?? "");
  const contentBuffer = encoding === "base64" ? Buffer.from(nextContent, "base64") : Buffer.from(nextContent, "utf8");

  if (operation === "replace") {
    return contentBuffer;
  }

  const existingBuffer = readExistingWriteBuffer(options.absolutePath, options.requestedPath);

  if (operation === "append") {
    return Buffer.concat([existingBuffer, contentBuffer]);
  }
  if (operation === "prepend") {
    return Buffer.concat([contentBuffer, existingBuffer]);
  }
  if (encoding !== "utf8") {
    throw createHttpError("Insert writes require utf8 encoding: " + options.requestedPath, 400);
  }

  const existingText = existingBuffer.toString("utf8");
  const insertOffset = resolveTextInsertOffset(existingText, options.insertTarget, options.requestedPath);
  return Buffer.from(existingText.slice(0, insertOffset) + nextContent + existingText.slice(insertOffset), "utf8");
}

function ensureValidWriteEncoding(encoding) {
  if (encoding === "utf8" || encoding === "base64") {
    return encoding;
  }
  throw createHttpError(`Unsupported write encoding: ${String(encoding || "")}`, 400);
}

function normalizeWriteEntries(options = {}) {
  if (Array.isArray(options.files)) {
    if (options.files.length === 0) {
      throw createHttpError("File write batch must not be empty.", 400);
    }
    return options.files;
  }
  if ("files" in options) {
    throw createHttpError("File write batch must provide a files array.", 400);
  }
  return [{ after: options.after, before: options.before, content: options.content, encoding: options.encoding, line: options.line, operation: options.operation, path: options.path }];
}

function normalizeWriteRequests(options = {}) {
  const accessController = createAppAccessController({
    groupIndex: getGroupIndex(options.watchdog, options.runtimeParams),
    runtimeParams: options.runtimeParams,
    username: options.username
  });
  const entries = normalizeWriteEntries(options);
  const seenProjectPaths = new Set();

  return entries.map((entry) => {
    if (!isPlainObject(entry)) {
      throw createHttpError("Each file write entry must be an object.", 400);
    }
    const requestedPath = String(entry.path || "").trim();
    const isDirectory = requestedPath.endsWith("/");
    const normalizedProjectPath = normalizeAppProjectPath(
      resolveUserShorthandPath(requestedPath, accessController.username),
      { isDirectory }
    );
    if (!normalizedProjectPath) {
      throw createHttpError("Expected a writable path: " + (requestedPath || "(empty)"), 400);
    }
    if (seenProjectPaths.has(normalizedProjectPath)) {
      throw createHttpError("Duplicate file write path: " + toAppRelativePath(normalizedProjectPath), 400);
    }
    seenProjectPaths.add(normalizedProjectPath);
    ensurePublicAppProjectPath(normalizedProjectPath);
    ensureWritableProjectPath(normalizedProjectPath, accessController);

    const operation = ensureValidWriteOperation(getExplicitWriteField(entry, options, "operation"));
    const insertTarget = normalizeWriteInsertTarget(entry, options, operation, requestedPath);

    if (isDirectory) {
      const content = entry.content;
      if (content !== undefined && content !== null && content !== "") {
        throw createHttpError("Directory writes do not accept content: " + requestedPath, 400);
      }
      if (operation !== "replace") {
        throw createHttpError("Directory writes do not support " + operation + ": " + requestedPath, 400);
      }
      return {
        absolutePath: createAbsolutePath(String(options.projectRoot || ""), normalizedProjectPath, options.runtimeParams),
        isDirectory: true,
        path: toAppRelativePath(normalizedProjectPath),
        projectPath: normalizedProjectPath
      };
    }

    const encoding = ensureValidWriteEncoding(
      String(getExplicitWriteField(entry, options, "encoding") || "utf8").toLowerCase()
    );
    const absolutePath = createAbsolutePath(String(options.projectRoot || ""), normalizedProjectPath, options.runtimeParams);
    const buffer = buildWriteBuffer({
      absolutePath,
      content: getExplicitWriteField(entry, options, "content"),
      encoding,
      insertTarget,
      operation,
      requestedPath
    });
    return { absolutePath, buffer, encoding, isDirectory: false, path: toAppRelativePath(normalizedProjectPath), projectPath: normalizedProjectPath };
  });
}

function writeAppFiles(options = {}) {
  const requests = normalizeWriteRequests(options);
  const quotaDeltas = getWriteQuotaDeltas(options, requests);
  const quotaPlan = createQuotaPlan(options, quotaDeltas);
  let totalBytesWritten = 0;
  let files;

  try {
    files = requests.map((request) => {
      if (request.isDirectory) {
        fs.mkdirSync(request.absolutePath, { recursive: true });
        return { path: request.path };
      }
      fs.mkdirSync(path.dirname(request.absolutePath), { recursive: true });
      fs.writeFileSync(request.absolutePath, request.buffer);
      totalBytesWritten += request.buffer.length;
      return { bytesWritten: request.buffer.length, encoding: request.encoding, path: request.path };
    });
  } catch (error) {
    invalidateQuotaDeltas(options, quotaDeltas);
    throw error;
  }

  applyUserFolderQuotaPlan(quotaPlan);
  recordAppPathMutations(
    { projectRoot: options.projectRoot, quotaCacheUpdated: true, runtimeParams: options.runtimeParams },
    requests.map((request) => request.projectPath)
  );
  return { bytesWritten: totalBytesWritten, count: files.length, files };
}

function writeAppFile(options = {}) {
  return writeAppFiles(options).files[0];
}

// ── Transfer operations ───────────────────────────────────────────────────────

function normalizeTransferEntries(options = {}, actionLabel) {
  if (Array.isArray(options.entries)) {
    if (options.entries.length === 0) {
      throw createHttpError(`File ${actionLabel} batch must not be empty.`, 400);
    }
    return options.entries;
  }
  if ("entries" in options) {
    throw createHttpError(`File ${actionLabel} batch must provide an entries array.`, 400);
  }
  return [{ fromPath: options.fromPath ?? options.path, toPath: options.toPath ?? options.targetPath ?? options.destinationPath }];
}

function normalizeTransferRequests(options = {}, actionType) {
  const actionLabel = actionType === "copy" ? "copy" : "move";
  const pathIndex = getPathIndex(options.watchdog);
  const accessController = createAppAccessController({
    groupIndex: getGroupIndex(options.watchdog, options.runtimeParams),
    runtimeParams: options.runtimeParams,
    username: options.username
  });
  const entries = normalizeTransferEntries(options, actionLabel);

  const requests = entries.map((entry) => {
    if (!isPlainObject(entry)) {
      throw createHttpError(`Each file ${actionLabel} entry must be an object.`, 400);
    }
    const requestedFromPath = String(entry.fromPath || entry.path || entry.sourcePath || "").trim();
    const requestedToPath = String(entry.toPath || entry.targetPath || entry.destinationPath || "").trim();
    if (!requestedFromPath) {
      throw createHttpError(`File ${actionLabel} source path must not be empty.`, 400);
    }
    if (!requestedToPath) {
      throw createHttpError(`File ${actionLabel} destination path must not be empty.`, 400);
    }

    const resolvedSourcePath = resolveExistingProjectPath(
      pathIndex,
      resolveUserShorthandPath(requestedFromPath, accessController.username)
    );
    if (!resolvedSourcePath.projectPath || !resolvedSourcePath.exists) {
      throw createHttpError(`Path not found: ${requestedFromPath}`, 404);
    }
    ensurePublicAppProjectPath(resolvedSourcePath.projectPath);
    if (actionType === "copy") {
      ensureReadableProjectPath(resolvedSourcePath.projectPath, accessController);
    } else {
      ensureWritableProjectPath(resolvedSourcePath.projectPath, accessController);
    }

    const destinationProjectPath = normalizeAppProjectPath(
      resolveUserShorthandPath(requestedToPath, accessController.username),
      { isDirectory: resolvedSourcePath.isDirectory }
    );
    if (!destinationProjectPath) {
      throw createHttpError(`Expected a writable destination path: ${requestedToPath}`, 400);
    }
    ensurePublicAppProjectPath(destinationProjectPath);
    if (destinationProjectPath === resolvedSourcePath.projectPath) {
      throw createHttpError(`Source and destination must differ: ${requestedFromPath}`, 400);
    }

    const destinationParentProjectPath = getParentDirectoryProjectPath(destinationProjectPath);
    if (!destinationParentProjectPath || !hasPath(pathIndex, destinationParentProjectPath)) {
      throw createHttpError(`Destination parent folder not found: ${requestedToPath}`, 404);
    }

    ensureWritableProjectPath(destinationProjectPath, accessController);
    ensureWritableProjectPath(destinationParentProjectPath, accessController);

    if (hasExistingProjectPathConflict(pathIndex, destinationProjectPath)) {
      throw createHttpError(`Destination already exists: ${toAppRelativePath(destinationProjectPath)}`, 400);
    }

    if (resolvedSourcePath.isDirectory && isDescendantPath(resolvedSourcePath.projectPath, destinationProjectPath)) {
      throw createHttpError(`Cannot ${actionLabel} a folder into itself: ${requestedFromPath}`, 400);
    }

    return {
      fromPath: toAppRelativePath(resolvedSourcePath.projectPath),
      isDirectory: resolvedSourcePath.isDirectory,
      sourceAbsolutePath: createAbsolutePath(String(options.projectRoot || ""), resolvedSourcePath.projectPath, options.runtimeParams),
      sourceProjectPath: resolvedSourcePath.projectPath,
      toPath: toAppRelativePath(destinationProjectPath),
      destinationAbsolutePath: createAbsolutePath(String(options.projectRoot || ""), destinationProjectPath, options.runtimeParams),
      destinationProjectPath
    };
  });

  requests.forEach((request, index) => {
    requests.slice(0, index).forEach((previousRequest) => {
      if (request.sourceProjectPath === previousRequest.sourceProjectPath) {
        throw createHttpError(`Duplicate file ${actionLabel} source path: ${request.fromPath}`, 400);
      }
      if (request.destinationProjectPath === previousRequest.destinationProjectPath) {
        throw createHttpError(`Duplicate file ${actionLabel} destination path: ${request.toPath}`, 400);
      }
      if (
        isDescendantPath(request.sourceProjectPath, previousRequest.sourceProjectPath) ||
        isDescendantPath(previousRequest.sourceProjectPath, request.sourceProjectPath)
      ) {
        throw createHttpError(
          `Overlapping file ${actionLabel} source paths are not allowed: ${previousRequest.fromPath} and ${request.fromPath}`,
          400
        );
      }
      if (
        isDescendantPath(request.destinationProjectPath, previousRequest.destinationProjectPath) ||
        isDescendantPath(previousRequest.destinationProjectPath, request.destinationProjectPath)
      ) {
        throw createHttpError(
          `Overlapping file ${actionLabel} destination paths are not allowed: ${previousRequest.toPath} and ${request.toPath}`,
          400
        );
      }
    });
  });

  return requests;
}

function copyAbsolutePath(sourceAbsolutePath, destinationAbsolutePath, isDirectory) {
  fs.cpSync(sourceAbsolutePath, destinationAbsolutePath, { errorOnExist: true, force: false, recursive: isDirectory });
}

function moveAbsolutePath(sourceAbsolutePath, destinationAbsolutePath, isDirectory) {
  try {
    fs.renameSync(sourceAbsolutePath, destinationAbsolutePath);
  } catch (error) {
    if (error?.code !== "EXDEV") {
      throw error;
    }
    copyAbsolutePath(sourceAbsolutePath, destinationAbsolutePath, isDirectory);
    fs.rmSync(sourceAbsolutePath, { force: false, recursive: isDirectory });
  }
}

function copyAppPaths(options = {}) {
  const requests = normalizeTransferRequests(options, "copy");
  const quotaDeltas = getCopyQuotaDeltas(options, requests);
  const quotaPlan = createQuotaPlan(options, quotaDeltas);
  let entries;

  try {
    entries = requests.map((request) => {
      copyAbsolutePath(request.sourceAbsolutePath, request.destinationAbsolutePath, request.isDirectory);
      return { fromPath: request.fromPath, toPath: request.toPath };
    });
  } catch (error) {
    invalidateQuotaDeltas(options, quotaDeltas);
    throw error;
  }

  applyUserFolderQuotaPlan(quotaPlan);
  recordAppPathMutations(
    { projectRoot: options.projectRoot, quotaCacheUpdated: true, runtimeParams: options.runtimeParams },
    requests.map((request) => request.destinationProjectPath)
  );
  return { count: entries.length, entries };
}

function copyAppPath(options = {}) {
  return copyAppPaths(options).entries[0];
}

function moveAppPaths(options = {}) {
  const requests = normalizeTransferRequests(options, "move");
  const quotaDeltas = getMoveQuotaDeltas(options, requests);
  const quotaPlan = createQuotaPlan(options, quotaDeltas);
  let entries;

  try {
    entries = requests.map((request) => {
      moveAbsolutePath(request.sourceAbsolutePath, request.destinationAbsolutePath, request.isDirectory);
      return { fromPath: request.fromPath, toPath: request.toPath };
    });
  } catch (error) {
    invalidateQuotaDeltas(options, quotaDeltas);
    throw error;
  }

  applyUserFolderQuotaPlan(quotaPlan);
  recordAppPathMutations(
    { projectRoot: options.projectRoot, quotaCacheUpdated: true, runtimeParams: options.runtimeParams },
    requests.flatMap((request) => [request.sourceProjectPath, request.destinationProjectPath])
  );
  return { count: entries.length, entries };
}

function moveAppPath(options = {}) {
  return moveAppPaths(options).entries[0];
}

// ── Delete operations ────────────────────────────────────────────────────────

function normalizeDeleteEntries(options = {}) {
  if (Array.isArray(options.paths)) {
    if (options.paths.length === 0) {
      throw createHttpError("File delete batch must not be empty.", 400);
    }
    return options.paths;
  }
  if (options.paths !== undefined) {
    throw createHttpError("File delete batch must provide a paths array.", 400);
  }
  return [options.path];
}

function normalizeDeleteRequests(options = {}) {
  const pathIndex = getPathIndex(options.watchdog);
  const accessController = createAppAccessController({
    groupIndex: getGroupIndex(options.watchdog, options.runtimeParams),
    runtimeParams: options.runtimeParams,
    username: options.username
  });
  const entries = normalizeDeleteEntries(options);

  const requests = entries.map((entry) => {
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
      throw createHttpError(`Path not found: ${requestedPath}`, 404);
    }
    ensurePublicAppProjectPath(resolvedPath.projectPath);
    ensureWritableProjectPath(resolvedPath.projectPath, accessController);
    return {
      absolutePath: createAbsolutePath(String(options.projectRoot || ""), resolvedPath.projectPath, options.runtimeParams),
      isDirectory: resolvedPath.isDirectory,
      path: toAppRelativePath(resolvedPath.projectPath),
      projectPath: resolvedPath.projectPath
    };
  });

  requests.forEach((request, index) => {
    requests.slice(0, index).forEach((previousRequest) => {
      if (request.projectPath === previousRequest.projectPath) {
        throw createHttpError(`Duplicate file delete path: ${request.path}`, 400);
      }
      if (
        isDescendantPath(request.projectPath, previousRequest.projectPath) ||
        isDescendantPath(previousRequest.projectPath, request.projectPath)
      ) {
        throw createHttpError(
          `Overlapping file delete paths are not allowed: ${previousRequest.path} and ${request.path}`,
          400
        );
      }
    });
  });

  return requests;
}

function deleteAppPaths(options = {}) {
  const requests = normalizeDeleteRequests(options);
  const quotaDeltas = getDeleteQuotaDeltas(options, requests);
  const quotaPlan = createQuotaPlan(options, quotaDeltas);
  let paths;

  try {
    paths = requests.map((request) => {
      fs.rmSync(request.absolutePath, { force: false, recursive: request.isDirectory });
      return request.path;
    });
  } catch (error) {
    invalidateQuotaDeltas(options, quotaDeltas);
    throw error;
  }

  applyUserFolderQuotaPlan(quotaPlan);
  recordAppPathMutations(
    { projectRoot: options.projectRoot, quotaCacheUpdated: true, runtimeParams: options.runtimeParams },
    requests.map((request) => request.projectPath)
  );
  return { count: paths.length, paths };
}

function deleteAppPath(options = {}) {
  return { path: deleteAppPaths(options).paths[0] };
}

// ── List operations ──────────────────────────────────────────────────────────

function getDirectChildPath(directoryPath, descendantPath, pathIndex) {
  const directorySegments = stripTrailingSlash(directoryPath).split("/").filter(Boolean);
  const descendantSegments = stripTrailingSlash(descendantPath).split("/").filter(Boolean);
  if (descendantSegments.length <= directorySegments.length) {
    return "";
  }
  const childBasePath = `/${descendantSegments.slice(0, directorySegments.length + 1).join("/")}/`;
  if (hasPath(pathIndex, childBasePath)) {
    return childBasePath;
  }
  return `/${descendantSegments.slice(0, directorySegments.length + 1).join("/")}`;
}

function collectAncestorDirectories(targetDirectoryPath, descendantPath, pathIndex) {
  const targetSegments = stripTrailingSlash(targetDirectoryPath).split("/").filter(Boolean);
  const descendantSegments = stripTrailingSlash(descendantPath).split("/").filter(Boolean);
  const output = [];
  for (let length = targetSegments.length + 1; length < descendantSegments.length; length += 1) {
    const candidatePath = `/${descendantSegments.slice(0, length).join("/")}/`;
    if (hasPath(pathIndex, candidatePath)) {
      output.push(candidatePath);
    }
  }
  return output;
}

function listAppPaths(options = {}) {
  const pathIndex = getPathIndex(options.watchdog);
  const accessMode = normalizeAccessMode(options.access || (options.writableOnly ? "write" : "read"));
  const accessController = createAppAccessController({
    groupIndex: getGroupIndex(options.watchdog, options.runtimeParams),
    runtimeParams: options.runtimeParams,
    username: options.username
  });

  if (options.gitRepositories) {
    const baseProjectPath = normalizeAppProjectPath(
      resolveUserShorthandPath(options.path || "/app/", accessController.username),
      { allowAppRoot: true, isDirectory: true }
    );
    const targetPathInfo = parseAppProjectPath(baseProjectPath);

    if (!baseProjectPath) {
      throw createHttpError("Path not found.", 404);
    }
    if (targetPathInfo && targetPathInfo.kind === "owner-path") {
      ensureProjectPathAccess(baseProjectPath, accessController, accessMode);
    }

    const repositoryPaths = listLayerHistoryRepositories({
      access: accessMode,
      projectRoot: options.projectRoot,
      runtimeParams: options.runtimeParams,
      username: options.username,
      watchdog: options.watchdog
    })
      .map((repository) => normalizeAppProjectPath(repository.path, { isDirectory: true }))
      .filter((projectPath) => projectPath && isSameOrDescendantPath(baseProjectPath, projectPath))
      .sort((left, right) => left.localeCompare(right))
      .map((projectPath) => toAppRelativePath(projectPath));

    return { access: accessMode, gitRepositories: true, path: toAppRelativePath(baseProjectPath), paths: repositoryPaths, recursive: true };
  }

  const resolvedPath = resolveExistingProjectPath(
    pathIndex,
    resolveUserShorthandPath(options.path || "/app/", accessController.username)
  );

  if (!resolvedPath.projectPath || !resolvedPath.exists) {
    throw createHttpError("Path not found.", 404);
  }

  ensurePublicAppProjectPath(resolvedPath.projectPath);

  if (!resolvedPath.isDirectory) {
    ensureProjectPathAccess(resolvedPath.projectPath, accessController, accessMode);
    return {
      access: accessMode,
      path: toAppRelativePath(resolvedPath.projectPath),
      paths: [toAppRelativePath(resolvedPath.projectPath)],
      recursive: false
    };
  }

  const targetPathInfo = parseAppProjectPath(resolvedPath.projectPath);
  if (targetPathInfo && targetPathInfo.kind === "owner-path") {
    ensureProjectPathAccess(resolvedPath.projectPath, accessController, accessMode);
  }

  const recursive = Boolean(options.recursive);
  const allPaths = Object.keys(pathIndex).sort((left, right) => left.localeCompare(right));
  const accessibleDescendants = allPaths.filter((projectPath) => {
    if (isReservedAppProjectPath(projectPath)) {
      return false;
    }
    if (!isDescendantPath(resolvedPath.projectPath, projectPath)) {
      return false;
    }
    const pathInfo = parseAppProjectPath(projectPath);
    if (!pathInfo || pathInfo.kind !== "owner-path") {
      return false;
    }
    return canAccessProjectPath(projectPath, accessController, accessMode);
  });

  const outputPaths = new Set();

  if (recursive) {
    for (const projectPath of accessibleDescendants) {
      outputPaths.add(projectPath);
      for (const ancestorPath of collectAncestorDirectories(resolvedPath.projectPath, projectPath, pathIndex)) {
        if (accessMode === "read" || canAccessProjectPath(ancestorPath, accessController, accessMode)) {
          outputPaths.add(ancestorPath);
        }
      }
    }
  } else {
    for (const projectPath of accessibleDescendants) {
      const directChildPath = getDirectChildPath(resolvedPath.projectPath, projectPath, pathIndex);
      if (directChildPath && (accessMode === "read" || canAccessProjectPath(directChildPath, accessController, accessMode))) {
        outputPaths.add(directChildPath);
      }
    }
  }

  return {
    access: accessMode,
    path: toAppRelativePath(resolvedPath.projectPath),
    paths: [...outputPaths].sort((left, right) => left.localeCompare(right)).map((projectPath) => toAppRelativePath(projectPath)),
    recursive
  };
}

function listAppPathsByPatterns(options = {}) {
  const compiledPatterns = compileFilePathPatterns(options.patterns);
  const accessMode = normalizeAccessMode(options.access || (options.writableOnly ? "write" : "read"));
  const maxLayer = normalizeMaxLayer(options.maxLayer);
  const output = Object.create(null);

  for (const { sourcePattern } of compiledPatterns) {
    output[sourcePattern] = [];
  }

  if (compiledPatterns.length === 0) {
    return output;
  }

  if (options.gitRepositories) {
    const repositories = listLayerHistoryRepositories({
      access: accessMode,
      projectRoot: options.projectRoot,
      runtimeParams: options.runtimeParams,
      username: options.username,
      watchdog: options.watchdog
    });

    for (const repository of repositories) {
      const repositoryPath = normalizePathSegment(repository.path);
      const repositoryProjectPath = normalizeAppProjectPath(repository.path, { isDirectory: true });
      if (!repositoryProjectPath || !isProjectPathWithinMaxLayer(repositoryProjectPath, maxLayer)) {
        continue;
      }
      const syntheticGitPaths = [".git/", `${stripTrailingSlash(repositoryPath)}/.git/`, `app/${stripTrailingSlash(repositoryPath)}/.git/`];
      for (const compiledPattern of compiledPatterns) {
        if (syntheticGitPaths.some((gitPath) => compiledPattern.matcher.test(gitPath))) {
          output[compiledPattern.sourcePattern].push(repository.path);
        }
      }
    }

    for (const sourcePattern of Object.keys(output)) {
      output[sourcePattern] = [...new Set(output[sourcePattern])].sort((left, right) => left.localeCompare(right));
    }
    return output;
  }

  const groupIndex = getGroupIndex(options.watchdog, options.runtimeParams);

  if (hasFileIndexStateSystem(options.stateSystem)) {
    return listAppPathsByPatternsFromFileIndex({
      accessMode,
      compiledPatterns,
      groupIndex,
      maxLayer,
      output,
      runtimeParams: options.runtimeParams,
      stateSystem: options.stateSystem,
      username: options.username
    });
  }

  const ownerScopes =
    accessMode === "write"
      ? createWritableOwnerScopesFromWatchdog({
          groupIndex,
          maxLayer,
          runtimeParams: options.runtimeParams,
          username: options.username,
          watchdog: options.watchdog
        })
      : createReadableOwnerScopesFromGroupIndex({
          groupIndex,
          maxLayer,
          runtimeParams: options.runtimeParams,
          username: options.username
        });

  if (ownerScopes.length === 0) {
    return output;
  }

  const pathBuckets = new Map();

  for (const projectPath of getSortedProjectPaths(options.watchdog)) {
    if (isReservedAppProjectPath(projectPath)) {
      continue;
    }
    if (!isProjectPathWithinMaxLayer(projectPath, maxLayer)) {
      continue;
    }
    const ownerScope = findOwnerScope(projectPath, ownerScopes);
    if (!ownerScope) {
      continue;
    }
    const relativePath = projectPath.slice(ownerScope.rootPath.length);
    if (!relativePath) {
      continue;
    }
    if (!pathBuckets.has(ownerScope.rank)) {
      pathBuckets.set(ownerScope.rank, []);
    }
    pathBuckets.get(ownerScope.rank).push({ projectPath, relativePath });
  }

  for (const ownerScope of ownerScopes) {
    const pathEntries = pathBuckets.get(ownerScope.rank) || [];
    for (const pathEntry of pathEntries) {
      addPatternMatchesForPath(output, compiledPatterns, pathEntry.projectPath, pathEntry.relativePath);
    }
  }

  return output;
}

// ─── Re-exported public API ──────────────────────────────────────────────────

// Note: createHttpError, toAppRelativePath, createAppAccessController,
// createReadableOwnerScopesFromGroupIndex, createWritableOwnerScopesFromState,
// createWritableOwnerScopesFromWatchdog are already re-exported from sub-modules.

export {
  copyAppPath,
  copyAppPaths,
  deleteAppPath,
  deleteAppPaths,
  getAppFolderDownloadInfo,
  getAppPathInfo,
  listAppPaths,
  listAppPathsByPatterns,
  moveAppPath,
  moveAppPaths,
  readAppFile,
  readAppFiles,
  writeAppFile,
  writeAppFiles
};