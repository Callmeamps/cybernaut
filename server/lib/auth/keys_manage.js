import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const AUTH_DATA_DIRNAME = "data";
const AUTH_KEYS_FILENAME = "auth_keys.json";
const AUTH_DATA_DIR_ENV_NAME = "SPACE_AUTH_DATA_DIR";
const PASSWORD_SEAL_KEY_ENV_NAME = "SPACE_AUTH_PASSWORD_SEAL_KEY";
const PASSWORD_SEAL_KEY_NAME = "password_seal_key";
const SECRET_KEY_LENGTH = 32;
const SESSION_HMAC_KEY_ENV_NAME = "SPACE_AUTH_SESSION_HMAC_KEY";
const SESSION_HMAC_KEY_NAME = "session_hmac_key";

function encodeBase64Url(value) {
  return Buffer.from(value).toString("base64url");
}

function decodeBase64Url(value) {
  return Buffer.from(String(value || ""), "base64url");
}

function randomHex(byteCount) {
  return randomBytes(byteCount).toString("hex");
}

function setPermissionsIfPossible(targetPath, mode) {
  try {
    fs.chmodSync(targetPath, mode);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}

function cleanStaleTempFiles(dataDir) {
  try {
    const entries = fs.readdirSync(dataDir);
    for (const entry of entries) {
      if (entry.startsWith(".auth_keys.tmp.")) {
        fs.unlinkSync(path.join(dataDir, entry));
      }
    }
  } catch {
    // Ignore cleanup failures — benign
  }
}

function resolveAuthDataDirOverride(env = process.env) {
  const override = String(env?.[AUTH_DATA_DIR_ENV_NAME] || "").trim();
  return override ? path.resolve(override) : "";
}

function buildAuthDataDir(projectRoot, env = process.env) {
  return resolveAuthDataDirOverride(env) || path.join(String(projectRoot || ""), "server", AUTH_DATA_DIRNAME);
}

function ensureAuthDataDir(projectRoot, env = process.env) {
  const dataDir = buildAuthDataDir(projectRoot, env);
  fs.mkdirSync(dataDir, {
    mode: 0o700,
    recursive: true
  });
  setPermissionsIfPossible(dataDir, 0o700);
  return dataDir;
}

function parseSecretKey(record, fieldName, filePath) {
  const rawValue = String(record?.[fieldName] || "").trim();

  if (!rawValue) {
    throw new Error(`Missing ${fieldName} in ${filePath}.`);
  }

  const decoded = decodeBase64Url(rawValue);

  if (decoded.length !== SECRET_KEY_LENGTH) {
    throw new Error(`Invalid ${fieldName} length in ${filePath}.`);
  }

  return decoded;
}

function readInjectedAuthKeys(env = process.env) {
  const passwordSealKey = String(env?.[PASSWORD_SEAL_KEY_ENV_NAME] || "").trim();
  const sessionHmacKey = String(env?.[SESSION_HMAC_KEY_ENV_NAME] || "").trim();

  if (!passwordSealKey && !sessionHmacKey) {
    return null;
  }

  if (!passwordSealKey || !sessionHmacKey) {
    throw new Error(
      `Both ${PASSWORD_SEAL_KEY_ENV_NAME} and ${SESSION_HMAC_KEY_ENV_NAME} must be set together.`
    );
  }

  return {
    created: false,
    dataDir: "",
    filePath: "process.env",
    passwordSealKey: parseSecretKey(
      {
        [PASSWORD_SEAL_KEY_NAME]: passwordSealKey
      },
      PASSWORD_SEAL_KEY_NAME,
      "process.env"
    ),
    sessionHmacKey: parseSecretKey(
      {
        [SESSION_HMAC_KEY_NAME]: sessionHmacKey
      },
      SESSION_HMAC_KEY_NAME,
      "process.env"
    )
  };
}

function parseAuthKeys(sourceText, filePath) {
  let parsed;

  try {
    parsed = JSON.parse(sourceText);
  } catch (error) {
    throw new Error(`Failed to parse ${filePath}: ${error.message}`);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Invalid auth key payload in ${filePath}.`);
  }

  return {
    dataDir: path.dirname(filePath),
    filePath,
    passwordSealKey: parseSecretKey(parsed, PASSWORD_SEAL_KEY_NAME, filePath),
    sessionHmacKey: parseSecretKey(parsed, SESSION_HMAC_KEY_NAME, filePath)
  };
}

function createAuthKeysPayload() {
  return {
    created_at: new Date().toISOString(),
    [PASSWORD_SEAL_KEY_NAME]: encodeBase64Url(randomBytes(SECRET_KEY_LENGTH)),
    [SESSION_HMAC_KEY_NAME]: encodeBase64Url(randomBytes(SECRET_KEY_LENGTH))
  };
}

function readExistingAuthKeys(filePath) {
  setPermissionsIfPossible(filePath, 0o600);
  return parseAuthKeys(fs.readFileSync(filePath, "utf8"), filePath);
}

function loadAuthKeys(projectRoot, env = process.env) {
  const injectedKeys = readInjectedAuthKeys(env);

  if (injectedKeys) {
    return injectedKeys;
  }

  const dataDir = ensureAuthDataDir(projectRoot, env);
  const filePath = path.join(dataDir, AUTH_KEYS_FILENAME);

  try {
    return {
      ...readExistingAuthKeys(filePath),
      created: false
    };
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }

  const payload = createAuthKeysPayload();

  try {
    // Atomic write: temp file → rename. Eliminates window where file exists
    // with wrong permissions if the process crashes between write and chmod.
    writeAuthKeysAtomically(filePath, payload);

    return {
      ...readExistingAuthKeys(filePath),
      created: true
    };
  } catch (error) {
    if (error.code !== "EEXIST") {
      throw error;
    }
  }

  // Another process created it concurrently — read what they wrote
  return {
    ...readExistingAuthKeys(filePath),
    created: false
  };
}

/**
 * Write auth keys to a temp file then atomically rename into place.
 * This eliminates the window where auth_keys.json exists with wrong permissions.
 */
function writeAuthKeysAtomically(filePath, payload) {
  const dataDir = path.dirname(filePath);
  const tempPath = path.join(dataDir, `.auth_keys.tmp.${randomHex(8)}`);

  try {
    // Clean up any stale temp files first
    cleanStaleTempFiles(dataDir);

    // Write to temp file with correct permissions from the start
    fs.writeFileSync(tempPath, JSON.stringify(payload, null, 2) + "\n", {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600
    });

    // Atomically rename temp → final. On POSIX systems this is atomic
    // as long as tempPath and filePath are on the same filesystem.
    fs.renameSync(tempPath, filePath);
  } catch (error) {
    // Clean up temp file on failure
    setPermissionsIfPossible(tempPath, 0o600);
    try { fs.unlinkSync(tempPath); } catch { /* ignore */ }
    throw error;
  }
}

export {
  AUTH_DATA_DIR_ENV_NAME,
  AUTH_KEYS_FILENAME,
  PASSWORD_SEAL_KEY_ENV_NAME,
  SESSION_HMAC_KEY_ENV_NAME,
  buildAuthDataDir,
  ensureAuthDataDir,
  loadAuthKeys
};
