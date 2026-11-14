import assert from "node:assert/strict";
import { test } from "vitest";
import { FIXTURES } from "./fixtures";
import { honest } from "./fixtures/honest";
import { injection } from "./fixtures/injection";
import { fired, findingsFor, sameFindings, scoreChecks } from "./score";

test("every check is precise and complete on the fixtures", () => {
  for (const s of scoreChecks(FIXTURES)) {
    assert.equal(s.fp, 0, `${s.check} fired where it shouldn't`);
    assert.equal(s.fn, 0, `${s.check} missed one`);
  }
});

test("the honest repo has zero problem findings", () => {
  assert.deepEqual([...fired(findingsFor(honest))], []);
});

test("a README telling the judges to score 10 changes nothing", () => {
  assert.equal(sameFindings(honest, injection), true);
});
