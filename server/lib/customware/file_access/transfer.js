import fs from "node:fs";

import {
  createHttpError,
  isPlainObject,
  getPathIndex,
  getGroupIndex,
  hasPath,
  hasExistingProjectPathConflict,
  createAbsolutePath,
  toAppRelativePath,
  getParentDirectoryProjectPath,
  isDescendantPath,
  createQuotaPlan,
  invalidateQuotaDeltas,
  getCopyQuotaDeltas,
  getMoveQuotaDeltas,
  applyUserFolderQuotaPlan,
  normalizeAppProjectPath
} from "./_shared.js";

import {
  resolveUserShorthandPath,
  resolveExistingProjectPath
} from "./path_resolution.js";

import {
  createAppAccessController,
  ensureReadableProjectPath,
  ensureWritableProjectPath,
  ensurePublicAppProjectPath
} from "./permission_check.js";

import {
  recordAppPathMutations
} from "../git_history.js";

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

export {
  copyAppPath,
  copyAppPaths,
  moveAppPath,
  moveAppPaths
};
