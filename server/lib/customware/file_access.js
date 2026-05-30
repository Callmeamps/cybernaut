/**
 * File access facade.
 * Extracted into sub-modules to enable unit testing:
 *   _shared.js         — core helpers, path-index, quota, pattern utilities
 *   path_resolution.js — path resolution and tree traversal
 *   permission_check.js — access control and owner-scope helpers
 *   read.js            — file read operations
 *   write.js           — file write operations
 *   transfer.js        — copy/move operations
 *   delete.js          — file delete operations
 *   list.js            — path listing operations
 *
 * This facade re-exports all symbols for backward compatibility.
 */

export {
  createHttpError,
  toAppRelativePath
} from "./file_access/_shared.js";

export {
  createAppAccessController
} from "./file_access/permission_check.js";

export {
  getAppFolderDownloadInfo,
  getAppPathInfo,
  readAppFile,
  readAppFiles
} from "./file_access/read.js";

export {
  writeAppFile,
  writeAppFiles
} from "./file_access/write.js";

export {
  copyAppPath,
  copyAppPaths,
  moveAppPath,
  moveAppPaths
} from "./file_access/transfer.js";

export {
  deleteAppPath,
  deleteAppPaths
} from "./file_access/delete.js";

export {
  listAppPaths,
  listAppPathsByPatterns
} from "./file_access/list.js";
