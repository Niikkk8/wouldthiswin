// Voice answers are written down by the browser's own speech recognition (the Web Speech
// API), so no audio leaves for our servers and the words land in the answer box as they're
// said. These are the pure parts: reading a recognition result list, and joining what was
// said onto what was already in the box. The words are untrusted input, exactly like typing.

export type RecognitionAlternative = { transcript: string };
export type RecognitionResult = ArrayLike<RecognitionAlternative> & { isFinal: boolean };
export type RecognitionResults = ArrayLike<RecognitionResult>;

/** What one recognition run has heard so far, from result `from` on: settled words, then the guess. */
export function heard(results: RecognitionResults, from = 0): { final: string; interim: string } {
  let final = "";
  let interim = "";
  for (let i = from; i < results.length; i++) {
    const r = results[i];
    const words = r[0]?.transcript ?? "";
    if (r.isFinal) final += ` ${words}`;
    else interim += ` ${words}`;
  }
  return { final: tidy(final), interim: tidy(interim) };
}

const tidy = (s: string) => s.replace(/\s+/g, " ").trim();

/** The answer box: what was there, then what's been said, one space between. */
export function joinSpoken(...parts: string[]): string {
  return parts
    .map((p) => p.trim())
    .filter(Boolean)
    .join(" ");
}

/**
 * The language to listen for: the browser's own, else US English. Only a well-formed BCP 47
 * tag is passed on; anything odd falls back.
 */
export function recognitionLang(language: string | undefined | null): string {
  return language && /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(language) ? language : "en-US";
}

/** Errors that mean the mic can't be used here at all, versus a pause worth restarting after. */
export function recognitionFailure(error: string): "denied" | "unsupported" | "lost" | null {
  if (error === "not-allowed" || error === "service-not-allowed") return "denied";
  if (error === "audio-capture" || error === "language-not-supported") return "unsupported";
  if (error === "network") return "lost";
  // "no-speech" and "aborted": nothing was wrong, the run just ended.
  return null;
}
