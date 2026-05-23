/**
 * Path resolution and tree traversal helpers.
 * Extracted from the monolithic file_access.js to enable unit testing.
 */

import {
  createHttpError,
  normalizeAppProjectPath,
  getPathIndex,
  hasPath,
  isReservedIndexedProjectPath,
  toAppRelativePath,
  toAppRelativeProjectPath,
  stripTrailingSlash,
  isDescendantPath
} from "./_shared.js";

export function resolveUserShorthandPath(inputPath, username) {
  const rawPath = String(inputPath || "").trim();
  if (!rawPath.startsWith("~")) {
    return rawPath;
  }
  if (!username) {
    throw createHttpError("User-relative paths require an authenticated user.", 400);
  }
  if (rawPath === "~") {
    return `L2/${username}/`;
  }
  if (rawPath.startsWith("~/")) {
    return `L2/${username}/${rawPath.slice(2)}`;
  }
  throw createHttpError(`Invalid user-relative path: ${rawPath}`, 400);
}

export function resolveExistingProjectPath(pathIndex, inputPath) {
  const rawInput = String(inputPath || "").trim();
  const fileProjectPath = normalizeAppProjectPath(rawInput);
  const directoryProjectPath = normalizeAppProjectPath(rawInput, {
    allowAppRoot: true,
    isDirectory: true
  });
  const prefersDirectory = rawInput.endsWith("/");

  if (prefersDirectory && directoryProjectPath && hasPath(pathIndex, directoryProjectPath)) {
    return { exists: true, isDirectory: true, projectPath: directoryProjectPath };
  }
  if (fileProjectPath && hasPath(pathIndex, fileProjectPath)) {
    return { exists: true, isDirectory: false, projectPath: fileProjectPath };
  }
  if (directoryProjectPath && hasPath(pathIndex, directoryProjectPath)) {
    return { exists: true, isDirectory: true, projectPath: directoryProjectPath };
  }
  return {
    exists: false,
    isDirectory: prefersDirectory,
    projectPath: prefersDirectory ? directoryProjectPath : fileProjectPath
  };
}

export function getDirectChildPath(directoryPath, descendantPath, pathIndex) {
  const directorySegments = stripTrailingSlash(directoryPath).split("/").filter(Boolean);
  const descendantSegments = stripTrailingSlash(descendantPath).split("/").filter(Boolean);

  if (descendantSegments.length <= directorySegments.length) {
    return "";
  }

  const childBasePath = `/${descendantSegments.slice(0, directorySegments.length + 1).join("/")}/`.replace(/\/\//g, "/").replace(/^\//, "/");
  // Rebuild properly
  const fullChild = "/" + descendantSegments.slice(0, directorySegments.length + 1).join("/") + "/";
  const childDirectoryPath = fullChild;
  const trimmed = stripTrailingSlash(childDirectoryPath);

  if (hasPath(pathIndex, childDirectoryPath)) {
    return childDirectoryPath;
  }
  return trimSlash(trimSlash(childDirectoryPath) + "/");
}

function trimSlash(s) {
  return s.replace(/\/+$/, "");
}

export function collectAncestorDirectories(targetDirectoryPath, descendantPath, pathIndex) {
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