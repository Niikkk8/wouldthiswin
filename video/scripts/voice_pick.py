"""Picks the best Chatterbox take of each line (audio/voice/takes/) and copies it to
audio/voice/line-<id>.wav, with lines.json for voice_words.py.

"Best", measured (nobody's listening on this machine):
  1. words: Whisper must hear the script. Any missing/extra/wrong word rules a take out
     (TTS sometimes skips or repeats words, or garbles a name).
  2. life: pitch movement in semitones (the spread of the voiced F0 contour) and loudness
     movement (the spread of syllable peaks). A read-it-flat take scores low.
  3. pace: words per minute inside 140-200 (short-form narration sits around 160).
Writes audio/voice/takes/report.json with every take's numbers.
"""

import json
import os
import re
import shutil
import sys
from pathlib import Path

os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")
import numpy as np
import soundfile as sf
from faster_whisper import WhisperModel

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from pitch_stats import f0s  # noqa: E402
from script_v3 import LINES  # noqa: E402

TAKES = ROOT / "audio" / "voice" / "takes"
NUM = {"40": "forty", "3": "three", "30": "thirty"}


def norm_words(s: str) -> list[str]:
    # Whisper writes a spoken URL as one ("www.WouldThisWin.com") and drops the "d" of
    # "promised" before "something" (it's elided in speech too): neither is a misread.
    s = s.lower().replace("www.", "").replace(".com", " dot com").replace("promise ", "promised ").replace("-", " ")
    s = s.replace("wooddiswin", "wouldthiswin").replace("woodthiswin", "wouldthiswin").replace("wouldthiswin", "would this win")  # homophones.replace("readme", "read me").replace("read me", "readme")
    out = []
    for w in s.split():
        w = re.sub(r"[^a-z0-9']", "", w)
        w = NUM.get(w, w)
        if w:
            out.append(w)
    return out


def edit_distance(a: list[str], b: list[str]) -> int:
    d = list(range(len(b) + 1))
    for i in range(1, len(a) + 1):
        prev, d[0] = d[0], i
        for j in range(1, len(b) + 1):
            prev, d[j] = d[j], min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] != b[j - 1]))
    return d[-1]


def life(x: np.ndarray, sr: int) -> tuple[float, float]:
    f0 = f0s(x, sr)
    if len(f0) < 5:
        return 0.0, 0.0
    st = 12 * np.log2(f0 / np.median(f0))
    # 10th-90th percentile: wide enough to see the melody, narrow enough to ignore glitches.
    pitch = float(np.percentile(st, 90) - np.percentile(st, 10))
    h = int(0.05 * sr)
    env = np.array([np.sqrt(np.mean(x[i : i + h] ** 2)) for i in range(0, len(x) - h, h)])
    env = env[env > 0.02]
    loud = float(np.std(20 * np.log10(env))) if len(env) > 3 else 0.0
    return pitch, loud


def main():
    meta = json.loads((TAKES / "takes.json").read_text())
    model = WhisperModel("small.en", device="cpu", compute_type="int8")
    report, chosen = {}, []
    for lid, line in LINES.items():
        want = norm_words(line["text"])
        rows = []
        for tk in meta.get(lid, []):
            x, sr = sf.read(TAKES / tk["file"])
            x16 = np.interp(np.arange(0, len(x), sr / 16000), np.arange(len(x)), x).astype(np.float32)
            segs, _ = model.transcribe(x16, language="en")
            heard_text = " ".join(s.text for s in segs)
            errs = edit_distance(norm_words(heard_text), want)
            pitch, loud = life(x, sr)
            wpm = len(want) / (len(x) / sr) * 60
            pace_pen = max(0, 140 - wpm) + max(0, wpm - 200)
            # Pitch life counts, but past ~16 st it's more likely a squeak than drama.
            score = min(pitch, 16) + 0.6 * loud - 0.05 * pace_pen
            rows.append({**tk, "heard": heard_text.strip(), "errors": errs, "pitchSt": round(pitch, 2), "loudDb": round(loud, 2), "wpm": round(wpm), "score": round(score, 2)})
        ok = [r for r in rows if r["errors"] == 0] or sorted(rows, key=lambda r: r["errors"])[:1]
        best = max(ok, key=lambda r: r["score"])
        best["chosen"] = True
        report[lid] = rows
        shutil.copy(TAKES / best["file"], ROOT / "audio" / "voice" / f"line-{lid}.wav")
        chosen.append({"line": lid, "text": line["text"], "spoken": line["spoken"], "seconds": best["seconds"], "take": best["file"]})
        flag = "" if best["errors"] == 0 else f"  !! {best['errors']} word error(s): heard '{best['heard']}'"
        print(f"{lid:3s} {best['file']:22s} pitch {best['pitchSt']:5.2f} st  loud {best['loudDb']:4.1f} dB  {best['wpm']} wpm  ({len(ok)}/{len(rows)} clean){flag}")
    (TAKES / "report.json").write_text(json.dumps(report, indent=1))
    (ROOT / "audio" / "voice" / "lines.json").write_text(json.dumps({"voice": "chatterbox", "lines": chosen}, indent=1))


if __name__ == "__main__":
    main()
