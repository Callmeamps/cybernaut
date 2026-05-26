/**
 * Shared utilities and type helpers for file_access sub-modules.
 * Extracted from the monolithic file_access.js to enable unit testing.
 */

import fs from "node:fs";
import path from "node:path";

import { createRuntimeGroupIndex, getRuntimeGroupIndex } from "../group_runtime.js";
import { isReservedAppProjectPath } from "../git_history.js";
import {
  normalizeAppProjectPath,
  normalizeEntityId,
  parseAppProjectPath,
  resolveProjectAbsolutePath
} from "../layout.js";
import {
  getFileIndexShardValue,
  listStateAreaIds
} from "../module_state.js";
import {
  applyUserFolderQuotaPlan,
  createUserFolderQuotaPlan,
  getIndexedProjectPathSize,
  invalidateUserFolderSizeCacheForProjectPaths,
  readAbsolutePathSize
} from "../user_quota.js";
import { createEmptyGroupIndex } from "../overrides.js";
import { createReadableOwnerScopesFromGroupIndex } from "./permission_check.js";
import { globToRegExp, normalizePathSegment } from "../../utils/app_files.js";
import { isProjectPathWithinMaxLayer, normalizeMaxLayer } from "../layer_limit.js";
import { FILE_INDEX_AREA } from "../../../runtime/state_areas.js";

export { FILE_INDEX_AREA };
export { isReservedAppProjectPath, normalizeAppProjectPath, normalizeEntityId, parseAppProjectPath, resolveProjectAbsolutePath };
export { createRuntimeGroupIndex, getRuntimeGroupIndex };
export { getFileIndexShardValue, listStateAreaIds };
export { applyUserFolderQuotaPlan, createUserFolderQuotaPlan, getIndexedProjectPathSize, invalidateUserFolderSizeCacheForProjectPaths, readAbsolutePathSize };
export { createEmptyGroupIndex };
export { globToRegExp, normalizePathSegment };
export { isProjectPathWithinMaxLayer, normalizeMaxLayer };

// ─── Core type helpers ──────────────────────────────────────────────────────

export function createHttpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) && !Buffer.isBuffer(value);
}

export function stripTrailingSlash(value) {
  const text = String(value || "");
  return text.endsWith("/") ? text.slice(0, -1) : text;
}

// ─── Path-index helpers ─────────────────────────────────────────────────────

export function getPathIndex(watchdog) {
  if (!watchdog || typeof watchdog.getIndex !== "function") {
    return Object.create(null);
  }
  return watchdog.getIndex("path_index") || Object.create(null);
}

export function getSortedProjectPaths(watchdog) {
  if (watchdog && typeof watchdog.getPaths === "function") {
    return watchdog.getPaths();
  }
  return Object.keys(getPathIndex(watchdog)).sort((left, right) => left.localeCompare(right));
}

export function getGroupIndex(watchdog, runtimeParams) {
  return getRuntimeGroupIndex(watchdog, runtimeParams);
}

export function hasPath(pathIndex, projectPath) {
  return Boolean(pathIndex && projectPath && pathIndex[projectPath]);
}

export function hasExistingProjectPathConflict(pathIndex, projectPath) {
  const baseProjectPath = stripTrailingSlash(projectPath);
  return Boolean(
    baseProjectPath && (hasPath(pathIndex, baseProjectPath) || hasPath(pathIndex, `${baseProjectPath}/`))
  );
}

export function createAbsolutePath(projectRoot, projectPath, runtimeParams) {
  return resolveProjectAbsolutePath(projectRoot, projectPath, runtimeParams);
}

export function hasFileIndexStateSystem(stateSystem) {
  return Boolean(
    stateSystem &&
      typeof stateSystem === "object" &&
      !Array.isArray(stateSystem) &&
      typeof stateSystem.getValue === "function"
  );
}

export function toAppRelativePath(projectPath) {
  const normalizedProjectPath = normalizeAppProjectPath(projectPath, {
    allowAppRoot: true,
    isDirectory: String(projectPath || "").endsWith("/")
  });
  if (!normalizedProjectPath.startsWith("/app/")) {
    return "";
  }
  return normalizedProjectPath.slice("/app/".length);
}

export function toAppRelativeProjectPath(projectPath) {
  const normalizedProjectPath = String(projectPath || "");
  return normalizedProjectPath.startsWith("/app/")
    ? normalizedProjectPath.slice("/app/".length)
    : toAppRelativePath(normalizedProjectPath);
}

export function getParentDirectoryProjectPath(projectPath) {
  const normalizedProjectPath = stripTrailingSlash(String(projectPath || ""));
  if (!normalizedProjectPath || normalizedProjectPath === "/app") {
    return "";
  }
  const lastSlashIndex = normalizedProjectPath.lastIndexOf("/");
  if (lastSlashIndex <= 0) {
    return "";
  }
  return `${normalizedProjectPath.slice(0, lastSlashIndex)}/`;
}

export function isDescendantPath(ancestorDirectoryPath, candidatePath) {
  const ancestorBase = stripTrailingSlash(ancestorDirectoryPath);
  const candidateBase = stripTrailingSlash(candidatePath);
  return Boolean(
    ancestorBase && candidateBase && candidateBase !== ancestorBase && candidateBase.startsWith(`${ancestorBase}/`)
  );
}

export function isSameOrDescendantPath(ancestorDirectoryPath, candidatePath) {
  return (
    stripTrailingSlash(ancestorDirectoryPath) === stripTrailingSlash(candidatePath) ||
    isDescendantPath(ancestorDirectoryPath, candidatePath)
  );
}

export function isReservedIndexedProjectPath(projectPath) {
  const normalizedProjectPath = String(projectPath || "");
  return normalizedProjectPath.includes("/.git/") || normalizedProjectPath.endsWith("/.git/");
}

// ─── Pattern helpers ────────────────────────────────────────────────────────

export function normalizeFilePathPattern(value) {
  const rawValue = String(value ?? "").trim();
  if (!rawValue) {
    throw createHttpError("File pattern must not be empty.", 400);
  }
  try {
    const normalizedPattern = normalizePathSegment(rawValue);
    if (!normalizedPattern) {
      throw new Error("Empty file pattern.");
    }
    return normalizedPattern;
  } catch {
    throw createHttpError(`Invalid file pattern: ${rawValue}`, 400);
  }
}

export function compileFilePathPatterns(patterns) {
  const compiledPatterns = [];
  const seenPatterns = new Set();
  for (const value of Array.isArray(patterns) ? patterns : []) {
    const sourcePattern = String(value ?? "").trim();
    const normalizedPattern = normalizeFilePathPattern(sourcePattern);
    if (seenPatterns.has(sourcePattern)) {
      continue;
    }
    seenPatterns.add(sourcePattern);
    compiledPatterns.push({ matcher: globToRegExp(normalizedPattern), sourcePattern });
  }
  return compiledPatterns;
}

export function normalizeAccessMode(value = "read") {
  const rawValue = String(value || "read").trim().toLowerCase();
  if (!rawValue || rawValue === "read" || rawValue === "readable") {
    return "read";
  }
  if (rawValue === "write" || rawValue === "writable") {
    return "write";
  }
  throw createHttpError(`Unsupported access mode: ${String(value || "")}`, 400);
}

// ─── Owner-scope helpers ─────────────────────────────────────────────────────

export function listReadableGroupIds(username, groupIndex) {
  const normalizedUsername = normalizeEntityId(username);
  const orderedGroups =
    groupIndex && typeof groupIndex.getOrderedGroupsForUser === "function"
      ? groupIndex.getOrderedGroupsForUser(normalizedUsername)
      : [];
  const groupIds = [];
  if (
    groupIndex &&
    typeof groupIndex.isUserInGroup === "function" &&
    groupIndex.isUserInGroup(normalizedUsername, "_all")
  ) {
    groupIds.push("_all");
  }
  for (const groupId of orderedGroups) {
    if (groupId && groupId !== "_all") {
      groupIds.push(groupId);
    }
  }
  return groupIds;
}

export function createReadableOwnerScopes(options = {}) {
  const normalizedUsername = normalizeEntityId(options.username);
  const groupIds = listReadableGroupIds(
    normalizedUsername,
    createRuntimeGroupIndex(options.groupIndex || createEmptyGroupIndex(), options.runtimeParams)
  );
  const ownerScopes = [];
  let rank = 0;
  for (const groupId of groupIds) {
    ownerScopes.push({ rank, rootPath: `/app/L0/${groupId}/` });
    rank += 1;
  }
  for (const groupId of groupIds) {
    ownerScopes.push({ rank, rootPath: `/app/L1/${groupId}/` });
    rank += 1;
  }
  if (normalizedUsername) {
    ownerScopes.push({ rank, rootPath: `/app/L2/${normalizedUsername}/` });
  }
  return ownerScopes;
}

export function getFileIndexShardIdForOwnerRoot(rootPath = "") {
  const normalizedRootPath = String(rootPath || "");
  const match = normalizedRootPath.match(/^\/app\/(L0|L1|L2)\/([^/]+)\/$/u);
  if (!match) {
    return "";
  }
  if (match[1] === "L0") {
    return "L0";
  }
  return `${match[1]}/${match[2]}`;
}

export function isOwnerRootWithinMaxLayer(rootPath, maxLayer) {
  return isProjectPathWithinMaxLayer(rootPath, maxLayer);
}

export function findOwnerScope(projectPath, ownerScopes) {
  return ownerScopes.find((ownerScope) => projectPath.startsWith(ownerScope.rootPath)) || null;
}

export function addPatternMatchesForPath(output, compiledPatterns, projectPath, relativePath) {
  const appRelativePath = toAppRelativeProjectPath(projectPath);
  for (const compiledPattern of compiledPatterns) {
    if (compiledPattern.matcher.test(relativePath)) {
      output[compiledPattern.sourcePattern].push(appRelativePath);
    }
  }
}

// ─── Quota helpers ───────────────────────────────────────────────────────────

export function createQuotaPlan(options = {}, deltas = []) {
  return createUserFolderQuotaPlan(
    {
      projectRoot: options.projectRoot,
      runtimeParams: options.runtimeParams,
      stateSystem: options.stateSystem,
      watchdog: options.watchdog
    },
    deltas
  );
}

export function invalidateQuotaDeltas(options = {}, deltas = []) {
  invalidateUserFolderSizeCacheForProjectPaths(
    { projectRoot: options.projectRoot, runtimeParams: options.runtimeParams },
    deltas.map((delta) => delta.projectPath)
  );
}

export function getIndexedOrAbsolutePathSize(options = {}, projectPath, absolutePath) {
  const indexedSize = getIndexedProjectPathSize(
    { stateSystem: options.stateSystem, watchdog: options.watchdog },
    projectPath
  );
  return indexedSize === null ? readAbsolutePathSize(absolutePath) : indexedSize;
}

export function getWriteQuotaDeltas(options = {}, requests) {
  return requests.map((request) => ({
    deltaBytes:
      request.isDirectory
        ? 0
        : request.buffer.length - getIndexedOrAbsolutePathSize(options, request.projectPath, request.absolutePath),
    projectPath: request.projectPath
  }));
}

export function getCopyQuotaDeltas(options = {}, requests) {
  return requests.map((request) => ({
    deltaBytes: getIndexedOrAbsolutePathSize(options, request.sourceProjectPath, request.sourceAbsolutePath),
    projectPath: request.destinationProjectPath
  }));
}

export function getMoveQuotaDeltas(options = {}, requests) {
  return requests.flatMap((request) => {
    const movedBytes = getIndexedOrAbsolutePathSize(options, request.sourceProjectPath, request.sourceAbsolutePath);
    if (request.sourceProjectPath === request.destinationProjectPath) {
      return [{ deltaBytes: 0, projectPath: request.sourceProjectPath }];
    }
    return [
      { deltaBytes: -movedBytes, projectPath: request.sourceProjectPath },
      { deltaBytes: movedBytes, projectPath: request.destinationProjectPath }
    ];
  });
}

export function getDeleteQuotaDeltas(options = {}, requests) {
  return requests.map((request) => ({
    deltaBytes: -getIndexedOrAbsolutePathSize(options, request.projectPath, request.absolutePath),
    projectPath: request.projectPath
  }));
}

// ─── State-system helpers ────────────────────────────────────────────────────

export function getSortedShardProjectPaths(stateSystem, shardId, shardPathCache) {
  const normalizedShardId = String(shardId || "").trim();
  if (!normalizedShardId) {
    return [];
  }
  if (shardPathCache.has(normalizedShardId)) {
    return shardPathCache.get(normalizedShardId);
  }
  const shardValue = getFileIndexShardValue(stateSystem, normalizedShardId);
  const projectPaths = Object.keys(shardValue).sort((left, right) => left.localeCompare(right));
  shardPathCache.set(normalizedShardId, projectPaths);
  return projectPaths;
}

export function listAppPathsByPatternsFromFileIndex(options = {}) {
  const { accessMode, compiledPatterns, groupIndex, maxLayer, output, stateSystem } = options;
  const ownerScopes =
    accessMode === "write"
      ? createWritableOwnerScopesFromState({
          groupIndex,
          maxLayer,
          runtimeParams: options.runtimeParams,
          stateSystem,
          username: options.username
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
  const shardPathCache = new Map();
  for (const ownerScope of ownerScopes) {
    const shardId = getFileIndexShardIdForOwnerRoot(ownerScope.rootPath);
    if (!shardId) {
      continue;
    }
    for (const projectPath of getSortedShardProjectPaths(stateSystem, shardId, shardPathCache)) {
      if (isReservedIndexedProjectPath(projectPath)) {
        continue;
      }
      if (!projectPath.startsWith(ownerScope.rootPath)) {
        continue;
      }
      const relativePath = projectPath.slice(ownerScope.rootPath.length);
      if (!relativePath) {
        continue;
      }
      addPatternMatchesForPath(output, compiledPatterns, projectPath, relativePath);
    }
  }
  return output;
}

