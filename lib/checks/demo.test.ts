import assert from "node:assert/strict";
import { describe, test } from "vitest";
import type { Page } from "../demo-check";
import { checkDemos, demoCandidates, demoFindings } from "./demo";

const page = (over: Partial<Page>): Page => ({ ok: true, status: 200, finalUrl: null, contentType: "text/html", body: "<title>PulseBoard</title>", truncated: false, reason: null, ...over });

describe("finding demo links", () => {
  test("hosted apps, labelled links and the website field; never GitHub, badges or videos", () => {
    const readme = "Live demo: https://pulse.example.com\nhttps://pulseboard.vercel.app\n![b](https://img.shields.io/x)\nhttps://github.com/t/a\nRun at http://localhost:3000";
    assert.deepEqual(demoCandidates({ readme, homepage: "pulse.app", devpostLinks: ["https://youtu.be/abc"] }), [
      "https://pulse.app",
      "https://pulse.example.com",
      "https://pulseboard.vercel.app",
    ]);
  });
});

describe("what a judge would see", () => {
  test("localhost, unreachable, not-found pages, error codes", () => {
    const f = demoFindings(
      [
        { url: "http://localhost:3000", page: null },
        { url: "https://a.vercel.app", page: page({ ok: false, status: null, reason: "dnsFailed" }) },
        { url: "https://b.vercel.app", page: page({ ok: false, status: 404, body: "The deployment could not be found on Vercel." }) },
        { url: "https://c.example.com", page: page({ ok: false, status: 500, body: "" }) },
      ],
      "pulseboard",
    );
    assert.deepEqual(f.map((x) => x.title), [
      "The demo link points at localhost",
      "The demo link doesn't load",
      "The demo shows a deployment-not-found page",
      "The demo link answers 500",
    ]);
    assert.ok(f.every((x) => x.evidence[0].kind === "url"));
  });

  test("a default title is major; a title that doesn't name the project is minor", () => {
    const f = demoFindings(
      [
        { url: "https://a.app", page: page({ body: "<title>Create Next App</title>" }) },
        { url: "https://b.app", page: page({ body: "<title>Dashboard</title>" }) },
        { url: "https://c.app", page: page({ body: "<title>PulseBoard: crowd analytics</title>" }) },
      ],
      "PulseBoard",
    );
    assert.deepEqual(f.map((x) => [x.title, x.severity]), [
      ['The demo\'s page title is "Create Next App"', "major"],
      ["The demo's title doesn't name the project", "minor"],
    ]);
  });

  test("localhost links are never fetched", async () => {
    const asked: string[] = [];
    await checkDemos(["http://localhost:5173"], async (u) => (asked.push(u), page({})), "x");
    assert.deepEqual(asked, []);
  });
});
