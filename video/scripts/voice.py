"""The launch voiceover v2, generated locally with Kokoro-82M (no cloud, no API keys).

Superseded for the launch video by scripts/voice_cb.py (v3: Chatterbox, directed, script in
scripts/script_v3.py). Kept for the voice samples and as a fallback; its LINES are the v2 script.

One WAV per script line, so each line's timing and the pauses between them are set by the
video's timeline, not baked into one long take.

    python scripts/voice.py samples          # line 1 in every candidate voice -> audio/voice-samples/
    python scripts/voice.py lines            # every line in VOICE -> audio/voice/line-N.wav + lines.json

Switch the voice with the VOICE setting below (or the VOICE env var).
"""

import json
import os
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
from kokoro import KPipeline

ROOT = Path(__file__).resolve().parent.parent
RATE = 24000

# The chosen narrator. Candidates: am_michael, am_adam, bm_george, bm_lewis.
VOICE = os.environ.get("VOICE", "am_michael")
SPEED = float(os.environ.get("SPEED", "0.95"))
CANDIDATES = ["am_michael", "am_adam", "bm_george", "bm_lewis"]

# What's said, by line id. Captions use these same strings. Each judge gets a line on their
# own moment: 6a on the Engineer's punch-in, 6b on the Investor's, 6c on the Tired Judge dozing.
LINES = {
    "1": "the night before submission, every team asks one question.",
    "2": "would this win?",
    "3": "paste your repo. it reads your actual code.",
    "4": "and your odds move. live.",
    "5": "then three judges grill you. thirty seconds per question.",
    "6a": "the engineer reads your code.",
    "6b": "the investor asks who's paying.",
    "6c": "and the third one is very tired.",
    "7": "they talk about you. in front of you.",
    "8": "and tell you exactly what to fix before you submit.",
    "9": "would yours win? wouldthiswin dot com.",
}

# How it's spoken can differ from how it's captioned (Kokoro reads lowercase flat, so
# sentence case gives it the right intonation; the brand is spelled out to be said as words).
# A list is spoken in parts with PAUSE seconds of silence between them (the beat before the joke).
SPOKEN = {
    "1": "The night before submission, every team asks one question.",
    "2": "Would this win?",
    "3": "Paste your repo. It reads your actual code.",
    "4": "And your odds move. Live.",
    "5": "Then three judges grill you. Thirty seconds per question.",
    "6a": "The engineer reads your code.",
    "6b": "The investor asks who's paying.",
    "6c": ["And the third one is...", "very tired."],
    "7": "They talk about you. In front of you.",
    "8": "And tell you exactly what to fix before you submit.",
    "9": "Would yours win? Would this win dot com.",
}
PAUSE = 0.5


def speak(pipe: KPipeline, text: str, voice: str) -> np.ndarray:
    chunks = [np.asarray(audio) for _, _, audio in pipe(text, voice=voice, speed=SPEED, split_pattern=None)]
    audio = np.concatenate(chunks) if chunks else np.zeros(1)
    # Trim the model's own leading/trailing silence (the timeline sets the pauses).
    level = np.abs(audio)
    on = np.nonzero(level > 0.01)[0]
    if len(on):
        a, b = max(0, on[0] - int(0.03 * RATE)), min(len(audio), on[-1] + int(0.12 * RATE))
        audio = audio[a:b]
    return audio.astype(np.float32)


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "lines"
    pipes = {"a": KPipeline(lang_code="a", repo_id="hexgrad/Kokoro-82M"), "b": KPipeline(lang_code="b", repo_id="hexgrad/Kokoro-82M")}
    pick = lambda v: pipes[v[0]]  # am_* American English, bm_* British English
    if mode == "samples":
        out = ROOT / "audio" / "voice-samples"
        out.mkdir(parents=True, exist_ok=True)
        for v in CANDIDATES:
            a = speak(pick(v), SPOKEN["1"], v)
            sf.write(out / f"line1-{v}.wav", a, RATE)
            print(f"{v}: {len(a) / RATE:.2f}s")
        return
    out = ROOT / "audio" / "voice"
    out.mkdir(parents=True, exist_ok=True)
    meta = []
    for i, text in LINES.items():
        said = SPOKEN[i] if isinstance(SPOKEN[i], list) else [SPOKEN[i]]
        parts = [speak(pick(VOICE), x, VOICE) for x in said]
        gap = np.zeros(int(PAUSE * RATE), dtype=np.float32)
        a = np.concatenate([x for p in parts for x in (p, gap)][:-1])
        sf.write(out / f"line-{i}.wav", a, RATE)
        meta.append({"line": i, "text": text, "spoken": " ".join(said), "seconds": round(len(a) / RATE, 3)})
        print(f"line {i}: {len(a) / RATE:.2f}s  {text}")
    (out / "lines.json").write_text(json.dumps({"voice": VOICE, "speed": SPEED, "lines": meta}, indent=1))


if __name__ == "__main__":
    main()
