import {
  createHttpError,
  stripTrailingSlash,
  getPathIndex,
  getGroupIndex,
  getSortedProjectPaths,
  hasPath,
  toAppRelativePath,
  isDescendantPath,
  isSameOrDescendantPath,
  isReservedAppProjectPath,
  normalizeAccessMode,
  compileFilePathPatterns,
  normalizePathSegment,
  normalizeMaxLayer,
  isProjectPathWithinMaxLayer,
  findOwnerScope,
  addPatternMatchesForPath,
  hasFileIndexStateSystem,
  listAppPathsByPatternsFromFileIndex,
  normalizeAppProjectPath,
  parseAppProjectPath
} from "./_shared.js";

import {
  resolveUserShorthandPath,
  resolveExistingProjectPath
} from "./path_resolution.js";

import {
  createAppAccessController,
  ensureReadableProjectPath,
  ensurePublicAppProjectPath,
  ensureProjectPathAccess,
  canAccessProjectPath,
  createReadableOwnerScopesFromGroupIndex,
  createWritableOwnerScopesFromWatchdog
} from "./permission_check.js";

import {
  listLayerHistoryRepositories
} from "../git_history.js";

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

export {
  listAppPaths,
  listAppPathsByPatterns
};
