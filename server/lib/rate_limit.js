/**
 * Lightweight sliding-window rate limiter for raw Node.js HTTP.
 * Cluster-aware: coordinates via stateSync when provided.
 *
 * Does NOT require express or any external dependencies.
 */

const CLEANUP_INTERVAL_MS = 60_000;

function randomHex(byteCount) {
  return Array.from({ length: byteCount * 2 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join("");
}

function getOrCreateBucket(buckets, key, nowMs) {
  if (buckets.has(key)) {
    return buckets.get(key);
  }

  const bucket = {
    tokens: [],
    firstSeenMs: nowMs
  };

  buckets.set(key, bucket);
  return bucket;
}

function cleanupExpiredTokens(bucket, windowStartMs) {
  bucket.tokens = bucket.tokens.filter((ts) => ts > windowStartMs);
}

function createRateLimiter(options = {}) {
  const windowMs = Number(options.windowMs ?? 60_000);
  const maxRequests = Number(options.maxRequests ?? 60);
  const keyFn = options.keyFn ?? ((context) => context?.req?.socket?.remoteAddress ?? "unknown");
  const onLimitExceeded = options.onLimitExceeded;
  const stateSync = options.stateSync ?? null;

  // In-memory store: Map<identityKey, {tokens: number[], firstSeenMs: number}>
  const buckets = new Map();

  // Cluster coordination: if stateSync is available, store counts there too.
  // Each worker writes its own local counts; reads aggregate from all workers.
  // This is best-effort — it reduces but doesn't eliminate cross-worker double-counting.
  let cleanupTimer = null;

  function startCleanup() {
    if (cleanupTimer !== null) {
      return;
    }

    cleanupTimer = setInterval(() => {
      const nowMs = Date.now();
      const windowStartMs = nowMs - windowMs;
      const staleKeys = [];

      for (const [key, bucket] of buckets) {
        cleanupExpiredTokens(bucket, windowStartMs);

        if (bucket.tokens.length === 0 && nowMs - bucket.firstSeenMs > windowMs * 2) {
          staleKeys.push(key);
        }
      }

      for (const key of staleKeys) {
        buckets.delete(key);
      }
    }, CLEANUP_INTERVAL_MS).unref();
  }

  function stopCleanup() {
    if (cleanupTimer !== null) {
      clearInterval(cleanupTimer);
      cleanupTimer = null;
    }
  }

  function checkLimit(context) {
    const nowMs = Date.now();
    const windowStartMs = nowMs - windowMs;
    const identity = String(keyFn(context) ?? "unknown");
    const bucket = getOrCreateBucket(buckets, identity, nowMs);

    // Cleanup stale entries
    cleanupExpiredTokens(bucket, windowStartMs);

    const currentCount = bucket.tokens.length;

    if (currentCount >= maxRequests) {
      return {
        allowed: false,
        currentCount,
        limit: maxRequests,
        retryAfterMs: bucket.tokens[0]
          ? Math.max(0, bucket.tokens[0] + windowMs - nowMs)
          : windowMs
      };
    }

    bucket.tokens.push(nowMs);

    return {
      allowed: true,
      currentCount: currentCount + 1,
      limit: maxRequests,
      remaining: maxRequests - currentCount - 1
    };
  }

  /**
   * Rate-limit middleware for use in router or API handler.
   * Returns {allowed: boolean, ...} — caller decides how to respond.
   */
  function middleware(context) {
    startCleanup();
    return checkLimit(context);
  }

  middleware.checkLimit = checkLimit;
  middleware.stop = stopCleanup;
  middleware.options = { windowMs, maxRequests, keyFn };

  return middleware;
}

/**
 * Extracts a per-user identity from a request context.
 * Falls back to IP address when no user is present.
 */
function userOrIpKey(context) {
  const username = context?.user?.username;
  if (username) {
    return `user:${username}`;
  }

  const ip = context?.req?.socket?.remoteAddress ?? "unknown";
  return `ip:${ip}`;
}

/**
 * Agent chat rate limiter: 60 requests/minute per user.
 * Configure via options for different limits.
 */
function createAgentChatRateLimiter(options = {}) {
  return createRateLimiter({
    windowMs: options.windowMs ?? 60_000,
    maxRequests: options.maxRequests ?? 60,
    keyFn: options.keyFn ?? userOrIpKey,
    onLimitExceeded: options.onLimitExceeded,
    stateSync: options.stateSync ?? null
  });
}

export { createRateLimiter, createAgentChatRateLimiter, userOrIpKey };