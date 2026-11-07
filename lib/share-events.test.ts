import assert from "node:assert/strict";
import { test } from "node:test";
import { ShareEvent } from "./share-events";
import { captionFor, imageFileName, imagePath, linkedInUrl, reviewUrl } from "./site";

test("share events: the five kinds, a download needs its format, nothing else gets through", () => {
  for (const kind of ["share_image", "x_clicked", "linkedin_clicked", "caption_copied"]) assert.ok(ShareEvent.safeParse({ kind }).success, kind);
  assert.ok(ShareEvent.safeParse({ kind: "download", format: "story" }).success);
  assert.ok(ShareEvent.safeParse({ kind: "share_image", format: "portrait" }).success);
  assert.ok(!ShareEvent.safeParse({ kind: "download" }).success, "download without a format");
  assert.ok(!ShareEvent.safeParse({ kind: "download", format: "og" }).success, "not a post format");
  assert.ok(!ShareEvent.safeParse({ kind: "liked" }).success);
  assert.ok(!ShareEvent.safeParse({ kind: "x_clicked", extra: 1 }).success, "unknown fields");
  assert.ok(!ShareEvent.safeParse(null).success);
});

const r = { id: "abcdefgh23", repo: "team/queue less", oneLiner: "the one with the QR code", odds: 34 };

test("share links: caption, LinkedIn, image paths", () => {
  const caption = captionFor(r);
  assert.match(caption, /34% chance to win/);
  assert.match(caption, /"the one with the QR code"/);
  assert.ok(caption.endsWith(reviewUrl(r.id)), caption);
  assert.equal(new URL(linkedInUrl(r.id)).searchParams.get("url"), reviewUrl(r.id));
  assert.equal(imagePath(r.id, "story"), "/og/abcdefgh23/story.png");
  assert.equal(imageFileName(r, "portrait"), "wouldthiswin-queue-less-portrait.png");
});
