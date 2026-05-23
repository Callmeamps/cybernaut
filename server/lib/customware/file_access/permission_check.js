/**
 * Permission and access-control logic for file access.
 * Extracted from the monolithic file_access.js to enable unit testing.
 */

import {
  createHttpError,
  createRuntimeGroupIndex,
  getRuntimeGroupIndex,
  isOwnerRootWithinMaxLayer,
  listReadableGroupIds,
  createReadableOwnerScopes,
  getFileIndexShardIdForOwnerRoot,
  parseAppProjectPath,
  normalizeEntityId,
  normalizeMaxLayer,
  listStateAreaIds,
  getSortedProjectPaths,
  hasFileIndexStateSystem,
  FILE_INDEX_AREA,
  getGroupIndex,
  getPathIndex,
  hasPath,
  createEmptyGroupIndex,
  isReservedAppProjectPath
} from "./_shared.js";

export function createAppAccessController(options = {}) {
  const groupIndex = createRuntimeGroupIndex(
    options.groupIndex || createEmptyGroupIndex(),
    options.runtimeParams
  );
  const username = normalizeEntityId(options.username);
  const managedGroups = new Set(
    groupIndex && typeof groupIndex.getManagedGroupsForUser === "function"
      ? groupIndex.getManagedGroupsForUser(username)
      : []
  );
  const isAdmin = Boolean(
    username &&
      groupIndex &&
      typeof groupIndex.isUserInGroup === "function" &&
      groupIndex.isUserInGroup(username, "_admin")
  );

  function canReadProjectPath(projectPath) {
    const pathInfo = parseAppProjectPath(projectPath);
    if (!pathInfo || pathInfo.kind !== "owner-path") {
      return false;
    }
    if (pathInfo.ownerType === "user") {
      return Boolean(username && pathInfo.ownerId === username);
    }
    return Boolean(
      groupIndex &&
        typeof groupIndex.isUserInGroup === "function" &&
        groupIndex.isUserInGroup(username, pathInfo.ownerId)
    );
  }

  function canWriteProjectPath(projectPath) {
    const pathInfo = parseAppProjectPath(projectPath);
    if (!pathInfo || pathInfo.kind !== "owner-path") {
      return false;
    }
    if (pathInfo.layer === "L0") {
      return false;
    }
    if (isAdmin && (pathInfo.layer === "L1" || pathInfo.layer === "L2")) {
      return true;
    }
    if (pathInfo.ownerType === "user") {
      return Boolean(pathInfo.layer === "L2" && username && pathInfo.ownerId === username);
    }
    return Boolean(pathInfo.layer === "L1" && managedGroups.has(pathInfo.ownerId));
  }

  return {
    canReadProjectPath,
    canWriteProjectPath,
    isAdmin,
    managedGroups,
    username
  };
}

export function ensureReadableProjectPath(projectPath, accessController) {
  if (!accessController.canReadProjectPath(projectPath)) {
    throw createHttpError("Read access denied.", 403);
  }
}

export function ensureWritableProjectPath(projectPath, accessController) {
  if (isReservedAppProjectPath(projectPath)) {
    throw createHttpError("App-file access to Git metadata is not allowed.", 403);
  }
  if (!accessController.canWriteProjectPath(projectPath)) {
    throw createHttpError("Write access denied.", 403);
  }
}

export function ensurePublicAppProjectPath(projectPath) {
  if (isReservedAppProjectPath(projectPath)) {
    throw createHttpError("App-file access to Git metadata is not allowed.", 403);
  }
}

export function canAccessProjectPath(projectPath, accessController, accessMode = "read") {
  if (accessMode === "write") {
    return accessController.canWriteProjectPath(projectPath);
  }
  return accessController.canReadProjectPath(projectPath);
}

export function ensureProjectPathAccess(projectPath, accessController, accessMode = "read") {
  if (accessMode === "write") {
    ensureWritableProjectPath(projectPath, accessController);
    return;
  }
  ensureReadableProjectPath(projectPath, accessController);
}

export function createReadableOwnerScopesFromGroupIndex(options = {}) {
  const seenRootPaths = new Set();
  return createReadableOwnerScopes(options).filter((ownerScope) => {
    if (!isOwnerRootWithinMaxLayer(ownerScope.rootPath, options.maxLayer)) {
      return false;
    }
    if (seenRootPaths.has(ownerScope.rootPath)) {
      return false;
    }
    seenRootPaths.add(ownerScope.rootPath);
    return true;
  });
}

export function createWritableOwnerScopesFromState(options = {}) {
  const accessController = createAppAccessController({
    groupIndex: options.groupIndex,
    runtimeParams: options.runtimeParams,
    username: options.username
  });
  const maxLayer = normalizeMaxLayer(options.maxLayer);
  const ownerRootPaths = [];

  function addOwnerRootPath(rootPath) {
    if (!rootPath || ownerRootPaths.includes(rootPath)) {
      return;
    }
    if (!isOwnerRootWithinMaxLayer(rootPath, maxLayer)) {
      return;
    }
    ownerRootPaths.push(rootPath);
  }

  if (hasFileIndexStateSystem(options.stateSystem) && accessController.isAdmin) {
    for (const shardId of listStateAreaIds(options.stateSystem, FILE_INDEX_AREA)) {
      if (!shardId.startsWith("L1/") && !shardId.startsWith("L2/")) {
        continue;
      }
      addOwnerRootPath(`/app/${shardId}/`);
    }
  } else {
    [...accessController.managedGroups]
      .sort((left, right) => left.localeCompare(right))
      .forEach((groupId) => {
        addOwnerRootPath(`/app/L1/${groupId}/`);
      });
    if (accessController.username) {
      addOwnerRootPath(`/app/L2/${accessController.username}/`);
    }
  }

  return ownerRootPaths
    .sort((left, right) => left.localeCompare(right))
    .map((rootPath, rank) => ({ rank, rootPath }));
}

export function createWritableOwnerScopesFromWatchdog(options = {}) {
  const accessController = createAppAccessController({
    groupIndex: options.groupIndex,
    runtimeParams: options.runtimeParams,
    username: options.username
  });
  const ownerRootPaths = new Set();

  for (const projectPath of getSortedProjectPaths(options.watchdog)) {
    const pathInfo = parseAppProjectPath(projectPath);
    if (!pathInfo || pathInfo.kind !== "owner-path" || !["L1", "L2"].includes(pathInfo.layer)) {
      continue;
    }
    const ownerProjectPath = `/app/${pathInfo.layer}/${pathInfo.ownerId}/`;
    if (
      isOwnerRootWithinMaxLayer(ownerProjectPath, options.maxLayer) &&
      accessController.canWriteProjectPath(ownerProjectPath)
    ) {
      ownerRootPaths.add(ownerProjectPath);
    }
  }

  return [...ownerRootPaths]
    .sort((left, right) => left.localeCompare(right))
    .map((rootPath, rank) => ({ rank, rootPath }));
}