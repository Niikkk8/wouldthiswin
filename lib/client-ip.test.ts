import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { UNKNOWN_IP, clientIp, limitKey } from "./client-ip";

const req = (headers: Record<string, string>) => new Request("https://wouldthiswin.com/api/sessions", { headers });
const spoofed = { "x-real-ip": "6.6.6.6", "x-forwarded-for": "7.7.7.7, 8.8.8.8", "x-test-ip": "9.9.9.9" };

describe("rate limit IP", () => {
  test("off Vercel, client-sent IP headers are ignored: everyone shares one bucket", () => {
    assert.equal(clientIp(req(spoofed), {}), UNKNOWN_IP);
    assert.equal(clientIp(req(spoofed), { NODE_ENV: "production" }), UNKNOWN_IP);
  });

  test("x-forwarded-for is never read, even on Vercel", () => {
    assert.equal(clientIp(req({ "x-forwarded-for": "7.7.7.7" }), { VERCEL: "1" }), UNKNOWN_IP);
  });

  test("on Vercel, the platform's x-real-ip is used", () => {
    assert.equal(clientIp(req({ "x-real-ip": "203.0.113.5", "x-test-ip": "9.9.9.9" }), { VERCEL: "1" }), "203.0.113.5");
  });

  test("the test-only header works only when explicitly enabled, and never in production", () => {
    assert.equal(clientIp(req(spoofed), { WTW_TEST_IP_HEADER: "1", NODE_ENV: "development" }), "9.9.9.9");
    assert.equal(clientIp(req(spoofed), { WTW_TEST_IP_HEADER: "1", NODE_ENV: "production" }), UNKNOWN_IP);
    assert.equal(clientIp(req(spoofed), { NODE_ENV: "development" }), UNKNOWN_IP);
  });
});

describe("limit key", () => {
  test("IPv4 counts per address, IPv4-mapped IPv6 as the IPv4", () => {
    assert.equal(limitKey("203.0.113.5"), "203.0.113.5");
    assert.equal(limitKey("::ffff:203.0.113.5"), "203.0.113.5");
  });
  test("every address in one IPv6 /64 shares a key", () => {
    const a = limitKey("2001:db8:85a3:12:1:2:3:4");
    assert.equal(a, "2001:db8:85a3:12::/64");
    assert.equal(limitKey("2001:0db8:85a3:0012:ffff:ffff:ffff:ffff"), a);
    assert.equal(limitKey("2001:db8:85a3:12::1"), a);
    assert.notEqual(limitKey("2001:db8:85a3:13::1"), a);
    assert.equal(limitKey("2001:db8::1"), "2001:db8:0:0::/64");
  });
  test("the shared unknown bucket stays one bucket", () => {
    assert.equal(limitKey(UNKNOWN_IP), UNKNOWN_IP);
  });
});
