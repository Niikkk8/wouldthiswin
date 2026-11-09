import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { cookieHeader, keepCookies, type Jar } from "./demo-check";

describe("cookies across the redirect chain", () => {
  test("a host-only cookie goes back to the host that set it, and nowhere else", () => {
    const jar: Jar = new Map();
    keepCookies(jar, ["session=abc; Path=/; HttpOnly"], "app.streamlit.app");
    assert.equal(cookieHeader(jar, "app.streamlit.app"), "session=abc");
    assert.equal(cookieHeader(jar, "x.app.streamlit.app"), undefined);
    assert.equal(cookieHeader(jar, "evil.example"), undefined);
  });

  test("a Domain cookie covers subdomains; one for an unrelated domain is dropped", () => {
    const jar: Jar = new Map();
    keepCookies(jar, ["auth=1; Domain=.streamlit.io", "bad=1; Domain=evil.example"], "share.streamlit.io");
    assert.equal(cookieHeader(jar, "streamlit.io"), "auth=1");
    assert.equal(cookieHeader(jar, "api.streamlit.io"), "auth=1");
    assert.equal(cookieHeader(jar, "evil.example"), undefined);
  });

  test("a later cookie with the same name replaces the earlier one", () => {
    const jar: Jar = new Map();
    keepCookies(jar, ["a=1"], "x.com");
    keepCookies(jar, ["a=2", "b=3"], "x.com");
    assert.equal(cookieHeader(jar, "x.com"), "a=2; b=3");
  });
});
