import assert from "node:assert/strict";
import { describe, test } from "vitest";
import type { DemoCheck } from "./demo-check";
import { parseDemoLink } from "./demo-link";
import { checkDemoLink } from "./demo-link-check";

describe("parsing a demo link", () => {
  test("live sites, with or without https://", () => {
    assert.deepEqual(parseDemoLink("queue.vercel.app"), {
      kind: "site",
      url: "https://queue.vercel.app/",
    });
    assert.deepEqual(parseDemoLink(" https://myapp.com/demo "), {
      kind: "site",
      url: "https://myapp.com/demo",
    });
  });

  test("videos on YouTube, Loom, Vimeo and Google Drive", () => {
    const cases: [string, string][] = [
      ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "youtube"],
      ["youtu.be/dQw4w9WgXcQ", "youtube"],
      ["https://youtube.com/shorts/abcdefghijk", "youtube"],
      ["https://www.loom.com/share/0123456789abcdef", "loom"],
      ["https://vimeo.com/123456789", "vimeo"],
      ["https://drive.google.com/file/d/1AbCdEfGhIjK/view?usp=sharing", "drive"],
    ];
    for (const [input, provider] of cases) {
      const l = parseDemoLink(input);
      assert.equal(l?.kind, "video", input);
      if (l?.kind === "video") assert.equal(l.provider, provider, input);
    }
  });

  test("a video host's home page is just a site", () => {
    assert.equal(parseDemoLink("https://www.youtube.com/")?.kind, "site");
    assert.equal(parseDemoLink("https://vimeo.com/about")?.kind, "site");
  });

  test("rejects what can't be a public link", () => {
    for (const bad of [
      "",
      "not a link",
      "javascript:alert(1)",
      "ftp://files.example.com/demo",
      "http://localhost:3000",
      "http://intranet/demo",
      "https://user:pass@example.com",
      "https://" + "a".repeat(600) + ".com",
    ]) {
      assert.equal(parseDemoLink(bad), null, bad);
    }
  });
});

describe("checking a demo link", () => {
  const result = (loads: boolean, finalUrl: string): DemoCheck => ({
    loads,
    status: loads ? 200 : 404,
    finalUrl,
    title: null,
    defaultTitle: false,
    reason: loads ? null : "httpError",
    ms: 1,
  });
  /** A fake checkDemo that records the URLs it was asked for. */
  const fake = (respond: (url: string) => DemoCheck) => {
    const asked: string[] = [];
    const check = async (url: string) => {
      asked.push(url);
      return respond(url);
    };
    return { check, asked };
  };

  test("no link: none, and nothing is fetched", async () => {
    const f = fake(() => result(true, ""));
    assert.equal(await checkDemoLink(null, f.check), "none");
    assert.deepEqual(f.asked, []);
  });

  test("a live site that loads, or doesn't", async () => {
    assert.equal(
      await checkDemoLink(parseDemoLink("app.example.com"), fake((u) => result(true, u)).check),
      "loads",
    );
    assert.equal(
      await checkDemoLink(parseDemoLink("app.example.com"), fake((u) => result(false, u)).check),
      "dead",
    );
  });

  test("a YouTube video is checked through oEmbed, which 404s for a missing video", async () => {
    const link = parseDemoLink("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    const ok = fake((u) => result(true, u));
    assert.equal(await checkDemoLink(link, ok.check), "video");
    assert.match(ok.asked[0], /^https:\/\/www\.youtube\.com\/oembed\?format=json&url=/);
    assert.equal(await checkDemoLink(link, fake((u) => result(false, u)).check), "dead");
  });

  test("Vimeo and Loom go through their oEmbed endpoints too", async () => {
    const f = fake((u) => result(true, u));
    await checkDemoLink(parseDemoLink("https://vimeo.com/123456789"), f.check);
    await checkDemoLink(parseDemoLink("https://www.loom.com/share/abc123"), f.check);
    assert.match(f.asked[0], /^https:\/\/vimeo\.com\/api\/oembed\.json\?url=/);
    assert.match(f.asked[1], /^https:\/\/www\.loom\.com\/v1\/oembed\?url=/);
  });

  test("a private Drive file redirects to sign-in, so it's dead", async () => {
    const link = parseDemoLink("https://drive.google.com/file/d/1AbCdEfGhIjK/view");
    assert.equal(await checkDemoLink(link, fake((u) => result(true, u)).check), "video");
    assert.equal(
      await checkDemoLink(
        link,
        fake(() => result(true, "https://accounts.google.com/ServiceLogin")).check,
      ),
      "dead",
    );
  });
});
