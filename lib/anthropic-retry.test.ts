import assert from "node:assert/strict";
import { test } from "node:test";
import Anthropic from "@anthropic-ai/sdk";
import { BACKOFF_MS, MAX_RETRIES, SwampedError, withRetry } from "./anthropic-retry";
import { SESSION_BUDGET, overBudget } from "./budget";
import { GitHubError, toGitHubError } from "./github";

const apiError = (status: number) => Anthropic.APIError.generate(status, { error: { type: "x", message: "busy" } }, "busy", new Headers());
const quiet = <T>(fn: () => Promise<T>) => {
  const { warn, error } = console;
  console.warn = console.error = () => {};
  return fn().finally(() => Object.assign(console, { warn, error }));
};

test("429 and 529 are retried up to 3 times with growing waits, then the panel is swamped", async () => {
  for (const status of [429, 529]) {
    let calls = 0;
    const waits: number[] = [];
    await quiet(() =>
      assert.rejects(
        withRetry(async () => { calls++; throw apiError(status); }, "t", async (ms) => { waits.push(ms); }),
        (e) => e instanceof SwampedError && e.status === status,
      ),
    );
    assert.equal(calls, MAX_RETRIES + 1);
    assert.equal(waits.length, MAX_RETRIES);
    waits.forEach((w, i) => assert.ok(w >= BACKOFF_MS[i] && w < BACKOFF_MS[i] + 200, `wait ${i}: ${w}`));
  }
});

test("a busy call that recovers returns its result", async () => {
  let calls = 0;
  const out = await quiet(() => withRetry(async () => (++calls < 3 ? Promise.reject(apiError(529)) : "ok"), "t", async () => {}));
  assert.equal(out, "ok");
  assert.equal(calls, 3);
});

test("other errors are not retried", async () => {
  for (const err of [apiError(400), apiError(500), new Error("network")]) {
    let calls = 0;
    await assert.rejects(withRetry(async () => { calls++; throw err; }, "t", async () => {}), (e) => e === err);
    assert.equal(calls, 1);
  }
});

test("a rejected GitHub token is its own error, not 'GitHub is down'", async () => {
  await quiet(async () => {
    assert.equal(toGitHubError({ status: 401, message: "Bad credentials" }).code, "githubAuth");
    assert.equal(toGitHubError({ status: 403, response: { headers: {} } }).code, "githubAuth");
    assert.equal(toGitHubError({ status: 403, response: { headers: { "x-ratelimit-remaining": "0" } } }).code, "githubDown");
    assert.equal(toGitHubError({ status: 404 }).code, "notFound");
    assert.equal(toGitHubError({ status: 502 }).code, "githubDown");
    assert.equal(toGitHubError(new GitHubError("emptyRepo")).code, "emptyRepo");
  });
});

test("a session stops calling the model once it has spent its budget", () => {
  assert.equal(overBudget({ input: 40_000, output: 4_000 }), false);
  assert.equal(overBudget({ input: SESSION_BUDGET.input, output: 0 }), true);
  assert.equal(overBudget({ input: 0, output: SESSION_BUDGET.output }), true);
});
