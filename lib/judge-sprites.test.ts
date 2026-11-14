import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "vitest";
import {
  FRAMES,
  HEAD_CROP,
  REACTION_FRAME,
  SPRITE_SIZE,
  frameIndex,
  reactionForDelta,
  sheetPath,
} from "./judge-sprites";
import { JUDGES } from "./session";

const PUBLIC = path.resolve(import.meta.dirname, "../public");

/** Width and height from a PNG's IHDR chunk. */
function pngSize(file: string): { w: number; h: number } {
  const b = fs.readFileSync(file);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

test("a drop of 10 or more looks doubtful, a gain of 6 or more impressed", () => {
  assert.equal(reactionForDelta(-10), "drop");
  assert.equal(reactionForDelta(-25), "drop");
  assert.equal(reactionForDelta(-9), null);
  assert.equal(reactionForDelta(0), null);
  assert.equal(reactionForDelta(5), null);
  assert.equal(reactionForDelta(6), "gain");
  assert.equal(reactionForDelta(15), "gain");
});

test("every judge has the shared frames and a frame for each reaction", () => {
  for (const j of JUDGES) {
    const frames = FRAMES[j] as readonly string[];
    assert.deepEqual(frames.slice(0, 3), ["base", "blink", "talk"]);
    for (const f of Object.values(REACTION_FRAME[j]))
      assert.ok(frames.includes(f), `${j} has no ${f} frame`);
  }
  assert.ok((FRAMES.tired as readonly string[]).includes("dozing"));
});

test("frameIndex finds frames and falls back to base", () => {
  assert.equal(frameIndex("engineer", "base"), 0);
  assert.equal(frameIndex("tired", "dozing"), FRAMES.tired.length - 1);
  assert.equal(frameIndex("investor", "dozing"), 0);
});

test("each sprite sheet is one 128px row of every frame, in order", () => {
  for (const j of JUDGES) {
    const { w, h } = pngSize(path.join(PUBLIC, sheetPath(j)));
    assert.equal(h, SPRITE_SIZE, j);
    assert.equal(w, SPRITE_SIZE * FRAMES[j].length, j);
  }
});

test("head crops sit inside the sprite", () => {
  for (const j of JUDGES) {
    const c = HEAD_CROP[j];
    assert.ok(
      c.x >= 0 && c.y >= 0 && c.x + c.size <= SPRITE_SIZE && c.y + c.size <= SPRITE_SIZE,
      j,
    );
  }
});

test("public/judges ships only the sprite sheets, each a palette PNG", () => {
  const files = fs.readdirSync(path.join(PUBLIC, "judges")).sort();
  assert.deepEqual(files, JUDGES.map((j) => path.basename(sheetPath(j))).sort());
  for (const f of files) {
    // IHDR colour type 3: indexed colour.
    assert.equal(fs.readFileSync(path.join(PUBLIC, "judges", f))[25], 3, f);
  }
});
