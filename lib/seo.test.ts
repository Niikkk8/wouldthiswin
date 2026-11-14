import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, test } from "vitest";
import { copy } from "./copy";
import { MAX_DESCRIPTION, MAX_TITLE, fit, pageMeta } from "./seo";
import { breadcrumbs, webApplication } from "./structured-data";

describe("metadata", () => {
  test("titles and descriptions are cut at a word, never past the limit", () => {
    assert.equal(fit("short", 60), "short");
    const cut = fit("word ".repeat(40), MAX_TITLE);
    assert.ok(cut.length <= MAX_TITLE && cut.endsWith("…"));
  });

  test("every page has a canonical URL and OG and Twitter tags", () => {
    const m = pageMeta({ title: "T", description: "D", path: "/guides" });
    assert.match(String(m.alternates?.canonical), /\/guides$/);
    assert.equal(m.openGraph?.title, "T");
    assert.ok(m.twitter);
  });

  test("the site's own titles and descriptions already fit", () => {
    const pairs = [
      [copy.meta.title, copy.meta.description],
      [copy.seo.demo.title, copy.seo.demo.description],
      [copy.seo.privacy.title, copy.privacy.lede],
      [copy.seo.guides.title, copy.seo.guides.description],
    ];
    for (const [t, d] of pairs) {
      assert.ok(t.length <= MAX_TITLE, t);
      assert.ok(d.length <= MAX_DESCRIPTION, d);
    }
  });

  test("every guide's title and description fit", () => {
    const dir = path.join(process.cwd(), "content/guides");
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".mdx"))) {
      const src = fs.readFileSync(path.join(dir, f), "utf8");
      const title = src.match(/title:\s*"([^"]+)"/)?.[1] ?? "";
      const description = src.match(/description:\s*"([^"]+)"/)?.[1] ?? "";
      assert.ok(title && title.length <= MAX_TITLE, `${f}: ${title}`);
      assert.ok(description && description.length <= MAX_DESCRIPTION, `${f}: ${description.length}`);
    }
  });
});

describe("structured data", () => {
  test("the app is free developer software, by a person", () => {
    const g = webApplication()["@graph"] as Record<string, unknown>[];
    const app = g.find((x) => x["@type"] === "SoftwareApplication")!;
    assert.equal(app.applicationCategory, "DeveloperApplication");
    assert.deepEqual(app.offers, { "@type": "Offer", price: "0", priceCurrency: "USD" });
    assert.ok(g.some((x) => x["@type"] === "WebSite") && g.some((x) => x["@type"] === "Person"));
  });

  test("breadcrumbs start at home and number from 1", () => {
    const b = breadcrumbs([{ name: "Guides", path: "/guides" }]);
    assert.deepEqual(b.itemListElement.map((i) => i.position), [1, 2]);
  });
});
