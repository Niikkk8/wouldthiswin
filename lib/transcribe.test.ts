import assert from "node:assert/strict";
import { describe, test } from "vitest";
import { TRANSCRIBE_MODEL, TranscribeError, audioType, cleanTranscript, transcribe } from "./transcribe";

describe("audio types", () => {
  test("MediaRecorder's types, codecs dropped", () => {
    assert.equal(audioType("audio/webm;codecs=opus"), "audio/webm");
    assert.equal(audioType("audio/mp4"), "audio/mp4");
    assert.equal(audioType("AUDIO/OGG; codecs=opus"), "audio/ogg");
  });

  test("anything else is refused", () => {
    assert.equal(audioType("video/webm"), null);
    assert.equal(audioType("text/html"), null);
    assert.equal(audioType(""), null);
  });
});

describe("transcript cleanup", () => {
  test("one line, whitespace collapsed", () => {
    assert.equal(cleanTranscript("  We poll\n every   sixty seconds. ", 100), "We poll every sixty seconds.");
  });

  test("cut at a word near the limit", () => {
    assert.equal(cleanTranscript("alpha beta gamma delta", 16), "alpha beta gamma");
  });
});

describe("transcribe", () => {
  const ok = (body: unknown, status = 200) =>
    (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

  test("sends the audio to Whisper and returns the text", async () => {
    let sent: FormData | null = null;
    const spy = (async (_url: string, init: RequestInit) => {
      sent = init.body as FormData;
      return new Response(JSON.stringify({ text: "Twilio, in lib/sms.ts." }));
    }) as unknown as typeof fetch;
    const text = await transcribe(new Blob(["x"]), "audio/webm", { apiKey: "k", fetch: spy });
    assert.equal(text, "Twilio, in lib/sms.ts.");
    assert.equal(sent!.get("model"), TRANSCRIBE_MODEL);
    assert.equal((sent!.get("file") as File).name, "answer.webm");
  });

  test("no key is a configuration error, not a crash", async () => {
    await assert.rejects(transcribe(new Blob(["x"]), "audio/webm", { apiKey: "" }), (e) => e instanceof TranscribeError && e.reason === "unconfigured");
  });

  test("an upstream error or a malformed body is reported as upstream", async () => {
    await assert.rejects(transcribe(new Blob(["x"]), "audio/mp4", { apiKey: "k", fetch: ok({}, 500) }), /upstream/);
    await assert.rejects(transcribe(new Blob(["x"]), "audio/mp4", { apiKey: "k", fetch: ok({ words: [] }) }), /upstream/);
  });

  test("silence comes back as empty", async () => {
    await assert.rejects(transcribe(new Blob(["x"]), "audio/mp4", { apiKey: "k", fetch: ok({ text: "  " }) }), /empty/);
  });
});
