"""Word timings for each voiceover line, so the captions land word by word with the voice.

Transcribes audio/voice/line-N.wav with faster-whisper (word timestamps), then maps the
SCRIPT's words onto them (captions always show the script text, never the transcript).
Numbers and run-together words are normalised ("30" = "thirty", "would this win" =
"wouldthiswin"). Writes audio/voice/words.json: per line, [{text, start, end}] in seconds
from the start of that line's WAV.
"""

import json
import os
import re
import wave
from pathlib import Path

os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")
import numpy as np
from faster_whisper import WhisperModel

ROOT = Path(__file__).resolve().parent.parent
VOICE = ROOT / "audio" / "voice"
NUM = {"30": "thirty", "3": "three", "40": "forty"}
# Same sound, different spelling (and the "d" of "promised" is elided before "something").
ALIAS = {"wood": "would", "woodthiswin": "wouldthiswin", "wooddiswin": "wouldthiswin", "promise": "promised"}


def norm(w: str) -> str:
    w = re.sub(r"[^a-z0-9']", "", w.lower())
    w = NUM.get(w, w)
    return ALIAS.get(w, w)


def load16k(path: Path) -> np.ndarray:
    with wave.open(str(path), "rb") as w:
        sr, n = w.getframerate(), w.getnframes()
        x = np.frombuffer(w.readframes(n), dtype=np.int16).astype(np.float32) / 32768
    return np.interp(np.arange(0, len(x), sr / 16000), np.arange(len(x)), x).astype(np.float32)


def silences(x: np.ndarray, sr: int = 16000, floor: float = 0.01, least: float = 0.16) -> list[tuple[float, float]]:
    """Runs of silence at least `least` seconds long, as (start, end) seconds."""
    h = int(0.02 * sr)
    quiet = [np.abs(x[i : i + h]).max() < floor for i in range(0, len(x), h)]
    runs, s = [], None
    for i, q in enumerate(quiet + [False]):
        if q and s is None:
            s = i
        if not q and s is not None:
            if (i - s) * 0.02 >= least:
                runs.append((s * 0.02, i * 0.02))
            s = None
    return runs


def main():
    meta = json.loads((VOICE / "lines.json").read_text())
    model = WhisperModel("small.en", device="cpu", compute_type="int8")
    out = []
    for line in meta["lines"]:
        audio = load16k(VOICE / f"line-{line['line']}.wav")
        segs, _ = model.transcribe(audio, language="en", word_timestamps=True)
        gaps = silences(audio)
        heard = []
        for seg in segs:
            for w in seg.words:
                raw = w.word.strip().lower().replace("www.", "")
                # A spoken URL comes back as one token ("woodthiswin.com"): split off "dot com",
                # giving it the token's last third.
                if raw.rstrip(".").endswith(".com"):
                    cut = w.start + (w.end - w.start) * 0.66
                    heard.append({"t": norm(raw.rstrip(".")[:-4]), "start": w.start, "end": cut})
                    mid = (cut + w.end) / 2
                    heard.append({"t": "dot", "start": cut, "end": mid})
                    heard.append({"t": "com", "start": mid, "end": w.end})
                else:
                    heard.append({"t": norm(raw), "start": w.start, "end": w.end})
        script = line["text"].split()
        timed, k = [], 0
        for word in script:
            target = norm(word)
            # Consume heard words until their joined text covers the script word.
            start = heard[k]["start"] if k < len(heard) else (timed[-1]["end"] if timed else 0)
            acc, end = "", start
            while k < len(heard) and len(acc) < len(target):
                acc += heard[k]["t"]
                end = heard[k]["end"]
                k += 1
            # Whisper stretches a word's start back over a pause; a word starts after the silence.
            for g0, g1 in gaps:
                if g0 - 0.12 <= start < g1 < end:
                    start = min(g1, end)
            timed.append({"text": word, "start": round(start, 3), "end": round(end, 3)})
        out.append({"line": line["line"], "text": line["text"], "seconds": line["seconds"], "words": timed})
        print(line["line"], " ".join(f"{w['text']}@{w['start']:.2f}" for w in timed))
    (VOICE / "words.json").write_text(json.dumps(out, indent=1))


if __name__ == "__main__":
    main()
