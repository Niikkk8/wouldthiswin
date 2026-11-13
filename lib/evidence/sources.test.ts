import assert from "node:assert/strict";
import { describe, test } from "vitest";
import type { Page } from "../demo-check";
import { claimSources, fetchDevpost, parseDevpost, parseDevpostUrl } from "./sources";

const HTML = `<html><head><title>PulseBoard | Devpost</title><script>var x = "<div>";</script></head><body>
<div id="software-header"><h1>PulseBoard</h1></div>
<div id="app-details-left">
  <h2>Inspiration</h2><p>Crowds at stadiums get dangerous fast.</p>
  <h2>What it does</h2><p>PulseBoard predicts crowd density in real time using a custom ML model &amp; live camera feeds.</p>
</div>
<div id="built-with"><h2>Built With</h2><ul>
  <li><span class="cp-tag recognized-tag"><a href="/software/built-with/nextjs">next.js</a></span></li>
  <li><span class="cp-tag">python</span></li>
  <li><span class="cp-tag">python</span></li>
</ul></div>
<nav class="app-links"><ul><li><a href="https://pulseboard.vercel.app" target="_blank">pulseboard.vercel.app</a></li>
<li><a href="https://github.com/team/pulseboard">GitHub Repo</a></li></ul></nav>
</body></html>`;

describe("Devpost URLs", () => {
  test("only devpost.com project pages", () => {
    assert.equal(parseDevpostUrl("devpost.com/software/pulseboard"), "https://devpost.com/software/pulseboard");
    assert.equal(parseDevpostUrl("https://devpost.com/software/pulseboard/"), "https://devpost.com/software/pulseboard");
    assert.equal(parseDevpostUrl("https://evil.com/software/pulseboard"), null);
    assert.equal(parseDevpostUrl("https://devpost.com.evil.com/software/x"), null);
    assert.equal(parseDevpostUrl("https://devpost.com/hackathons"), null);
    assert.equal(parseDevpostUrl("javascript:alert(1)"), null);
  });
});

describe("parsing a Devpost page", () => {
  const d = parseDevpost(HTML);

  test("the write-up, without scripts or markup", () => {
    assert.match(d.about, /predicts crowd density in real time using a custom ML model & live camera feeds/);
    assert.doesNotMatch(d.about, /<|var x/);
  });

  test("built-with tags, deduplicated", () => {
    assert.deepEqual(d.builtWith, ["next.js", "python"]);
  });

  test("try-it-out links", () => {
    assert.deepEqual(d.links, ["https://pulseboard.vercel.app", "https://github.com/team/pulseboard"]);
  });

  test("a page without those sections parses to nothing, not to guesses", () => {
    assert.deepEqual(parseDevpost("<html><body>Not found</body></html>"), { about: "", builtWith: [], links: [] });
  });

  test("a failed fetch is null", async () => {
    const page = (ok: boolean): Page => ({ ok, status: ok ? 200 : 404, finalUrl: null, contentType: "text/html", body: ok ? HTML : "", truncated: false, reason: null });
    assert.equal(await fetchDevpost("https://devpost.com/software/x", async () => page(false)), null);
    assert.deepEqual((await fetchDevpost("https://devpost.com/software/x", async () => page(true)))?.builtWith, ["next.js", "python"]);
  });
});

describe("claim sources", () => {
  test("README always, then Devpost and pasted text when they have something", () => {
    const s = claimSources({ readme: "# Hi", devpost: parseDevpost(HTML), submission: "  We built it in 36 hours.  " });
    assert.deepEqual(s.map((x) => x.kind), ["readme", "devpost", "submission"]);
    assert.match(s[1].text, /Built with: next\.js, python$/);
    assert.equal(s[2].text, "We built it in 36 hours.");
    assert.deepEqual(claimSources({ readme: "# Hi", devpost: null, submission: " " }).map((x) => x.kind), ["readme"]);
  });
});
