import assert from "node:assert/strict";
import { describe, test } from "vitest";
import { NOT_JUDGED, badgeSvg, notJudgedBadgeSvg } from "./badge";

describe("badge", () => {
  test("shows the odds and tier, labelled for screen readers", () => {
    const svg = badgeSvg(61, "top3");
    assert.match(svg, /61% top 3/);
    assert.match(svg, /aria-label="would this win: 61% top 3"/);
  });

  test("a repo with no shareable verdict gets a neutral badge that claims nothing", () => {
    const svg = notJudgedBadgeSvg();
    assert.match(svg, new RegExp(NOT_JUDGED));
    assert.doesNotMatch(svg, />d+% /);
  });
});
