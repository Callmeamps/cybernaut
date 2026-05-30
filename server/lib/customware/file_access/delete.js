import fs from "node:fs";

import {
  createHttpError,
  isPlainObject,
  getPathIndex,
  getGroupIndex,
  createAbsolutePath,
  toAppRelativePath,
  isDescendantPath,
  createQuotaPlan,
  invalidateQuotaDeltas,
  getDeleteQuotaDeltas,
  applyUserFolderQuotaPlan
} from "./_shared.js";

import {
  resolveUserShorthandPath,
  resolveExistingProjectPath
} from "./path_resolution.js";

import {
  createAppAccessController,
  ensureWritableProjectPath,
  ensurePublicAppProjectPath
} from "./permission_check.js";

import {
  recordAppPathMutations
} from "../git_history.js";

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

export {
  deleteAppPath,
  deleteAppPaths
};
