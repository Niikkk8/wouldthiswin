"""The launch video's timeline, on the music's beat grid.

Inputs:
  audio/beats.json        {"source": "synth"|"detected", "bpm", "beats": [seconds...]}
  audio/voice/words.json  each voiceover line's length and word timings
Output:
  src/v2/timeline.json    every scene boundary, event, voice placement and caption word, in
                          seconds. Remotion, the music synth and the mixer all read it, so
                          picture and sound can't drift apart.

Rules: scene changes and impacts land on beats. A voice line starts where its scene wants it;
if that would collide with the next cut, the cut moves to a later beat (the voice wins). Key
words are pinned to beats: "your odds drop" on the drop, "go" on the Tired Judge's jolt.
"""

import bisect
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FPS = 30


def main():
    beats_doc = json.loads((ROOT / "audio" / "beats.json").read_text())
    beats = beats_doc["beats"]
    words = {str(w["line"]): w for w in json.loads((ROOT / "audio" / "voice" / "words.json").read_text())}

    def B(i: float) -> float:
        """The time of beat i (fractional i interpolates: 0.5 is the 'and')."""
        lo = int(i)
        if lo + 1 >= len(beats):
            period = beats[-1] - beats[-2]
            return beats[-1] + (i - (len(beats) - 1)) * period
        return beats[lo] + (i - lo) * (beats[lo + 1] - beats[lo])

    def next_beat(t: float) -> int:
        """Index of the first beat at or after t (a 20 ms grace)."""
        return bisect.bisect_left(beats, t - 0.02)

    voice = {}  # line -> {start, end}

    def hold(n: int) -> float:
        """How long a caption of n words holds after its last word lands."""
        return 0.7 + 0.04 * max(0, n - 3)

    def say(line: str, at: float):
        voice[line] = {"start": round(at, 3), "end": round(at + words[line]["seconds"], 3)}
        return voice[line]

    def at(line: str, word: str) -> float:
        """Seconds into a line's WAV where a word starts."""
        return next(w["start"] for w in words[line]["words"] if w["text"].lower().startswith(word))

    def last(line: str) -> float:
        """When a placed line's last word lands (absolute seconds)."""
        return voice[line]["start"] + words[line]["words"][-1]["start"]

    def done(line: str) -> int:
        """The first beat after a placed line's caption has had its reading time."""
        return next_beat(last(line) + hold(len(words[line]["words"])))

    S = {}
    # 1a: the hook. Frame 0 already shows the question; the voice starts at once.
    S["1a"] = {"beat": 0}
    l1 = say("1", 0.08)
    # 1b: "would this win?" slams on the first beat after a short breath.
    b = next_beat(l1["end"] + 0.3)
    S["1b"] = {"beat": b, "slam": B(b)}
    l2 = say("2", B(b))
    # 2: the repo is typed, the button pressed on a beat, then the camera zooms through.
    b = max(b + 3, next_beat(l2["end"] + 0.3))
    say("3", B(b) + 0.1)
    S["2"] = {"beat": b, "typeStart": B(b) + 0.05, "typeCharSec": 0.026, "press": B(b + 2)}
    # 3a: the scan, under line 4. Line 5 follows straight on, timed so "your odds drop" starts
    # exactly on the drop; the third beam turns red two beats before it, during "promised
    # something you didn't build?".
    b3 = b + 3
    l4 = say("4", B(b3) + 0.1)
    drop_beat = max(b3 + 6, next_beat(l4["end"] + 0.3 + at("5", "your")))
    say("5", B(drop_beat) - at("5", "your"))
    red = drop_beat - 2
    S["3a"] = {"beat": b3, "cascade": B(b3), "cascadeStagger": 0.06, "beams": [B(red - 3), B(red - 2), B(red - 1)], "beamSec": 0.4, "red": B(red), "riserStart": B(red)}
    # 3b: hard cut half a beat early, the number slams on the beat, on "your odds drop".
    S["3b"] = {"beat": drop_beat - 0.5, "cut": B(drop_beat - 0.5), "drop": B(drop_beat)}
    # 4: the panel slides in under line 6; the Engineer's punch-in is a hard cut on a beat, and
    # 6a ("the engineer wants proof") lands on it while his question types in.
    b = max(drop_beat + 3, done("5"))
    say("6", B(b) + 0.05)
    punch = max(b + 3, done("6"))
    say("6a", B(punch) + 0.05)
    S["4"] = {"beat": b, "slide": [B(b), B(b + 0.5), B(b + 1)], "punch": B(punch), "qStart": B(punch) + 0.05, "qWordSec": 0.08}
    # 5: the answer types; the Investor punches in on the next beat under 6b; once the answer's
    # in, the odds tick up and he looks impressed.
    b = done("6a")
    say("6b", B(b + 1) + 0.05)
    S["5"] = {"beat": b, "typeStart": B(b) + 0.05, "typeCharSec": 0.015, "punch": B(b + 1), "tick": B(b + 3)}
    # 6: the Tired Judge dozes under 6c; the music drops out for the beat before "go", and he
    # jolts awake exactly on "go".
    b = max(b + 5, done("6b"))
    jolt = next_beat(B(b) + 0.15 + at("6c", "go"))
    l6 = say("6c", B(jolt) - at("6c", "go"))
    S["6"] = {"beat": b, "pause": [B(jolt - 1), B(jolt)], "jolt": B(jolt)}
    # 7: the chat stacks in on the 8ths.
    b = max(jolt + 2, done("6c"), next_beat(l6["end"] + 0.3))
    say("7", B(b) + 0.15)
    S["7"] = {"beat": b, "bubbles": [B(b + 0.5), B(b + 1), B(b + 1.5), B(b + 2)], "typing": B(b + 2.5)}
    # 8: the review card flips in; the fixes stagger on the 8ths.
    b = max(b + 5, done("7"))
    say("8", B(b) + 0.15)
    S["8"] = {"beat": b, "flip": B(b), "fixes": [B(b + 2), B(b + 2.5), B(b + 3)]}
    # 9: the end card. The mark assembles over two beats (it lands on one), the URL rises.
    b = max(b + 6, done("8"))
    l9 = say("9", B(b) + 0.15)
    S["9"] = {"beat": b, "logo": B(b), "logoLand": B(b + 2), "url": B(b + 1), "sub": B(b + 2.5)}
    end_beat = max(b + 8, next_beat(l9["end"] + 1.4))

    order = ["1a", "1b", "2", "3a", "3b", "4", "5", "6", "7", "8", "9"]
    for i, k in enumerate(order):
        S[k]["start"] = round(B(S[k]["beat"]), 3)
        S[k]["end"] = round(B(S[order[i + 1]]["beat"]) if i + 1 < len(order) else B(end_beat), 3)

    # Captions: the script's words, timed to the voice, assigned to the scene they're said in.
    # A caption shows until its scene ends, or until the next caption in that scene starts.
    def caption(line: str, scene: str, first: int = 0, last: int | None = None, until: float | None = None):
        ws = words[line]["words"][first:last]
        base = voice[line]["start"]
        return {"scene": scene, "line": line, "words": [{"text": w["text"], "t": round(base + w["start"], 3)} for w in ws], "until": until}

    split5 = next(i for i, w in enumerate(words["5"]["words"]) if w["text"].lower() == "your")
    split9 = next(i for i, w in enumerate(words["9"]["words"]) if w["text"].lower() == "try")
    captions = [
        caption("1", "1a"),
        caption("2", "1b"),
        caption("3", "2"),
        caption("4", "3a", until=voice["5"]["start"]),
        caption("5", "3a", 0, split5),
        # The whole line again after the cut: its first half is already revealed, so the
        # sentence reads straight across the cut and "your odds drop" lands on the drop.
        caption("5", "3b"),
        caption("6", "4", until=S["4"]["punch"]),
        caption("6a", "4"),
        caption("6b", "5"),
        caption("6c", "6"),
        caption("7", "7"),
        caption("8", "8"),
        caption("9", "9", 0, split9),
        caption("9", "9", split9),
    ]
    for c in captions:
        c["until"] = round(c["until"] if c["until"] is not None else S[c["scene"]]["end"], 3)

    # Reading check. Captions reveal word by word with the voice, so the eye reads along; after
    # the last word lands each still holds ≥ 0.7 s + 0.04 s per word past three (it's paced
    # like a reel now: the next line follows as soon as this one has been read). Line 1 is on
    # screen, whole, from frame 0, so it's exempt.
    problems = []
    for c in captions[1:]:
        if c["scene"] == "3a" and c["line"] == "5":
            continue  # carried across the cut: checked as part of 3b's caption
        end = c["until"]
        need = hold(len(c["words"]))
        held = end - c["words"][-1]["t"]
        if held < need:
            problems.append(f"line {c['line']} in scene {c['scene']}: held {held:.2f}s, needs {need:.2f}s")

    tl = {
        "fps": FPS,
        "bpm": beats_doc["bpm"],
        "beatSource": beats_doc["source"],
        "beats": [round(x, 3) for x in beats if x <= B(end_beat) + 0.01],
        "duration": round(B(end_beat), 3),
        "frames": int(round(B(end_beat) * FPS)),
        "scenes": {k: {kk: (round(v, 3) if isinstance(v, float) else v) for kk, v in S[k].items()} for k in order},
        "voice": voice,
        "captions": captions,
        "readingProblems": problems,
    }
    (ROOT / "src" / "v2" / "timeline.json").write_text(json.dumps(tl, indent=1))
    print(f"{tl['duration']:.2f}s, {tl['frames']} frames, {len(tl['beats'])} beats ({beats_doc['source']}, {beats_doc['bpm']} bpm)")
    for k in order:
        print(f"  {k:3s} {S[k]['start']:6.2f} - {S[k]['end']:6.2f}")
    for p in problems:
        print("  READING:", p)


if __name__ == "__main__":
    main()
