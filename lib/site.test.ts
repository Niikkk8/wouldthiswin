import assert from "node:assert/strict";
import { describe, test } from "vitest";
import { badgeMarkdown, postToXUrl, repoBadgeMarkdown, reviewUrl, shareText, whatsAppUrl } from "./site";

const r = { id: "abcdefghjk", repo: "team/queueless", odds: 37, readyToWin: false };

describe("share links", () => {
  test("the verdict link is /v/[id]", () => {
    assert.match(reviewUrl(r.id), /\/v\/abcdefghjk$/);
  });

  test("the post text names the project, the odds and the status", () => {
    assert.equal(shareText(r), "the judges gave queueless a 37% chance. Changes requested.");
    assert.equal(shareText({ ...r, readyToWin: true }), "the judges gave queueless a 37% chance. Ready to win.");
  });

  test("X gets the text and the link; WhatsApp gets both in one message", () => {
    const x = new URL(postToXUrl(r));
    assert.equal(x.searchParams.get("text"), shareText(r));
    assert.equal(x.searchParams.get("url"), reviewUrl(r.id));
    assert.equal(new URL(whatsAppUrl(r)).searchParams.get("text"), `${shareText(r)} ${reviewUrl(r.id)}`);
  });

  test("badge markdown links to the verdict", () => {
    assert.match(badgeMarkdown(r.id), /\]\(https:\/\/[^)]+\/v\/abcdefghjk\)$/);
    assert.match(repoBadgeMarkdown(r.repo, r.id), /\/api\/badge\/team\/queueless\)\]\(/);
  });
});
