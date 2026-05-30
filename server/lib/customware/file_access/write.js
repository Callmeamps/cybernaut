import fs from "node:fs";
import path from "node:path";

import {
  createHttpError,
  isPlainObject,
  getPathIndex,
  getGroupIndex,
  createAbsolutePath,
  toAppRelativePath,
  createQuotaPlan,
  invalidateQuotaDeltas,
  getWriteQuotaDeltas,
  applyUserFolderQuotaPlan,
  normalizeAppProjectPath
} from "./_shared.js";

import {
  resolveUserShorthandPath
} from "./path_resolution.js";

import {
  createAppAccessController,
  ensureWritableProjectPath,
  ensurePublicAppProjectPath
} from "./permission_check.js";

import {
  recordAppPathMutations
} from "../git_history.js";

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

export {
  writeAppFile,
  writeAppFiles
};
