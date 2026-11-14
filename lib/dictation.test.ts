import assert from "node:assert/strict";
import { describe, test } from "vitest";
import {
  heard,
  joinSpoken,
  recognitionFailure,
  recognitionLang,
  type RecognitionResult,
} from "./dictation";

const result = (transcript: string, isFinal: boolean): RecognitionResult =>
  Object.assign([{ transcript }], { isFinal });

describe("heard", () => {
  test("settled words first, then the live guess", () => {
    const results = [result("the scores come from", true), result(" a seeded random", false)];
    assert.deepEqual(heard(results), {
      final: "the scores come from",
      interim: "a seeded random",
    });
  });

  test("skips results already taken in", () => {
    const results = [result("old words", true), result("new words", true)];
    assert.deepEqual(heard(results, 1), { final: "new words", interim: "" });
  });

  test("collapses the spacing browsers put between results", () => {
    assert.equal(heard([result("one", true), result("  two ", true)]).final, "one two");
  });

  test("an empty list hears nothing", () => {
    assert.deepEqual(heard([]), { final: "", interim: "" });
  });
});

describe("joinSpoken", () => {
  test("joins what was typed with what was said", () => {
    assert.equal(
      joinSpoken("We cache it. ", "", "then it streams"),
      "We cache it. then it streams",
    );
  });

  test("nothing typed, nothing said", () => {
    assert.equal(joinSpoken("", " ", ""), "");
  });
});

describe("recognitionLang", () => {
  test("the browser's language when it's a real tag", () => {
    assert.equal(recognitionLang("en-GB"), "en-GB");
    assert.equal(recognitionLang("pt-BR"), "pt-BR");
  });

  test("US English otherwise", () => {
    assert.equal(recognitionLang(undefined), "en-US");
    assert.equal(recognitionLang(""), "en-US");
    assert.equal(recognitionLang("not a language"), "en-US");
  });
});

describe("recognitionFailure", () => {
  test("permission errors turn the mic off", () => {
    assert.equal(recognitionFailure("not-allowed"), "denied");
    assert.equal(recognitionFailure("service-not-allowed"), "denied");
  });

  test("no microphone or language means typing", () => {
    assert.equal(recognitionFailure("audio-capture"), "unsupported");
    assert.equal(recognitionFailure("language-not-supported"), "unsupported");
  });

  test("silence and aborts are not failures", () => {
    assert.equal(recognitionFailure("no-speech"), null);
    assert.equal(recognitionFailure("aborted"), null);
  });

  test("a dropped connection stops listening", () => {
    assert.equal(recognitionFailure("network"), "lost");
  });
});
