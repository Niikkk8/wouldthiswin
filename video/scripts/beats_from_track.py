"""Beats for a real music track, so every cut lands on the music.

    python scripts/beats_from_track.py audio/music.mp3

Runs claude-motion's beat detector (audio_engine/cm_beats.py: tempo, beat grid, downbeats,
the drop) over a 45 s window placed so the drop lands about 40% in, then shifts the window to
start exactly on a beat, so the video's beat 0 is frame 0. Writes audio/beats.json with
source "detected", the BPM, the beats (seconds from the window start) and trackStart (where
in the track the video begins; the mixer trims the track there).
"""

import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PY = sys.executable
DET = ROOT / "audio_engine" / "cm_beats.py"
env = {**os.environ, "PATH": str(ROOT / ".bin") + os.pathsep + os.environ.get("PATH", "")}


def detect(track: str, start: str, out: Path) -> dict:
    subprocess.run([PY, str(DET), track, "--duration", "45", "--start", start, "-o", str(out)], check=True, env=env)
    return json.loads(out.read_text())


def main():
    track = sys.argv[1]
    tmp = ROOT / "audio" / "build"
    tmp.mkdir(parents=True, exist_ok=True)
    first = detect(track, "auto", tmp / "beats-auto.json")
    start = first["start"] + (first["beats"][0] if first["beats"] else 0)
    d = detect(track, f"{start:.3f}", tmp / "beats-aligned.json")
    beats = [b for b in d["beats"] if b >= -0.01]
    out = {"source": "detected", "bpm": d["bpm"], "beats": beats, "trackStart": round(start, 3), "drop": d.get("drop")}
    (ROOT / "audio" / "beats.json").write_text(json.dumps(out))
    print(f"{Path(track).name}: {d['bpm']} bpm, video starts {start:.2f}s into the track, {len(beats)} beats, drop at {d.get('drop')}")


if __name__ == "__main__":
    main()
