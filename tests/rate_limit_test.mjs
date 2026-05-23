/**
 * Tests for server/lib/rate_limit.js
 * Run with: node --test tests/rate_limit_test.mjs
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { createRateLimiter, createAgentChatRateLimiter, userOrIpKey } from "../server/lib/rate_limit.js";

describe("createRateLimiter", () => {
  it("allows requests under the limit", () => {
    const limiter = createRateLimiter({ maxRequests: 5, windowMs: 60_000 });
    const context = { req: { socket: { remoteAddress: "127.0.0.1" } } };

    for (let i = 0; i < 5; i++) {
      const result = limiter(context);
      assert.equal(result.allowed, true, `Request ${i + 1} should be allowed`);
      assert.equal(result.remaining, 5 - i - 1);
    }
  });

  it("blocks requests over the limit", () => {
    const limiter = createRateLimiter({ maxRequests: 3, windowMs: 60_000 });
    const context = { req: { socket: { remoteAddress: "127.0.0.2" } } };

    limiter(context);
    limiter(context);
    limiter(context);

    const blocked = limiter(context);
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.currentCount, 3);
    assert.ok(blocked.retryAfterMs > 0);
  });

  it("tracks requests separately per identity", () => {
    const limiter = createRateLimiter({ maxRequests: 2, windowMs: 60_000 });

    const alice = limiter({ req: { socket: { remoteAddress: "10.0.0.1" } } });
    const bob = limiter({ req: { socket: { remoteAddress: "10.0.0.2" } } });

    assert.equal(alice.allowed, true);
    assert.equal(bob.allowed, true);

    const alice2 = limiter({ req: { socket: { remoteAddress: "10.0.0.1" } } });
    const blocked = limiter({ req: { socket: { remoteAddress: "10.0.0.1" } } });

    assert.equal(alice2.allowed, true);
    assert.equal(blocked.allowed, false);

    // Bob should still be able to make requests
    const bob2 = limiter({ req: { socket: { remoteAddress: "10.0.0.2" } } });
    assert.equal(bob2.allowed, true);
  });

  it("respects custom keyFn", () => {
    const limiter = createRateLimiter({
      maxRequests: 1,
      windowMs: 60_000,
      keyFn: (ctx) => ctx.userId
    });

    const a1 = limiter({ userId: "user1" });
    const a2 = limiter({ userId: "user1" });
    const b1 = limiter({ userId: "user2" });

    assert.equal(a1.allowed, true);
    assert.equal(a2.allowed, false); // user1 blocked
    assert.equal(b1.allowed, true); // user2 is different identity
  });

  it("window slides — old tokens expire", async () => {
    const limiter = createRateLimiter({ maxRequests: 2, windowMs: 50 });
    const ctx = { req: { socket: { remoteAddress: "127.0.0.5" } } };

    limiter(ctx);
    limiter(ctx);
    const blocked = limiter(ctx);
    assert.equal(blocked.allowed, false, "Should be blocked at start");

    // Wait for window to slide
    await new Promise((r) => setTimeout(r, 60));

    const allowed = limiter(ctx);
    assert.equal(allowed.allowed, true, "Should be allowed after window slides");

    limiter.stop?.();
  });

  it("stops cleanup timer when stop() is called", () => {
    const limiter = createRateLimiter({ maxRequests: 60, windowMs: 60_000 });
    assert.ok(typeof limiter.stop === "function");

    limiter.stop();
    // Calling stop twice should not throw
    limiter.stop();
  });
});

describe("userOrIpKey", () => {
  it("returns user key when username is present", () => {
    assert.equal(userOrIpKey({ user: { username: "alice" } }), "user:alice");
  });

  it("returns IP key when no user is present", () => {
    assert.equal(
      userOrIpKey({ req: { socket: { remoteAddress: "1.2.3.4" } } }),
      "ip:1.2.3.4"
    );
  });

  it("prefers user key over IP", () => {
    const result = userOrIpKey({
      user: { username: "bob" },
      req: { socket: { remoteAddress: "5.6.7.8" } }
    });
    assert.equal(result, "user:bob");
  });
});

describe("createAgentChatRateLimiter", () => {
  it("defaults to 60 req/min per user", () => {
    const limiter = createAgentChatRateLimiter();
    assert.equal(limiter.options.maxRequests, 60);
    assert.equal(limiter.options.windowMs, 60_000);
    assert.equal(typeof limiter.options.keyFn, "function");
  });

  it("uses userOrIpKey by default", () => {
    const limiter = createAgentChatRateLimiter();
    assert.equal(limiter.options.keyFn({ user: { username: "test" } }), "user:test");
  });

  it("accepts custom maxRequests and windowMs", () => {
    const limiter = createAgentChatRateLimiter({ maxRequests: 10, windowMs: 30_000 });
    assert.equal(limiter.options.maxRequests, 10);
    assert.equal(limiter.options.windowMs, 30_000);
  });
});