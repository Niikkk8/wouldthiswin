"""Face reel sound: a hit on each finding, the verdict's impact and chime, the end card.

Stem only (the voice is the star): mastered to -20 LUFS so it sits under the voice, and the
whole reel is mastered to -14 afterwards. C major, like the v3 videos.
Run by scripts/reel-v3.ts: python -m sfx.cues.reel <hits.json> <out.wav>
"""

import json
import sys

from sfx.mix import Mix
from sfx.synth import blip, chime, impact, pop, riser, whoosh

C5, E5, G5, A5, C6, E6 = 523.25, 659.25, 783.99, 880.0, 1046.5, 1318.5


def main(src, out):
    with open(src, encoding="utf-8") as f:
        data = json.load(f)
    mix = Mix(data["duration"] + 0.5)
    findings = [h for h in data["hits"] if h["kind"] == "finding"]
    for i, h in enumerate(findings):
        # Each finding a step lower: the odds falling, one claim at a time.
        mix.put(h["t"], impact(0.45), 0.2)
        mix.put(h["t"], pop([E6, C6, A5, G5][i % 4], E5, 0.18), 0.18, pan=0.3)
    for h in data["hits"]:
        if h["kind"] == "verdict":
            mix.put(max(0, h["t"] - 1.0), riser(1.0, 300, 3000), 0.08)
            mix.put(h["t"], impact(1.0), 0.32)
            mix.put(h["t"] + 0.1, chime([C5, E5, G5], 1.6, 0.6), 0.14)
        elif h["kind"] == "end":
            mix.put(h["t"] - 0.08, whoosh(0.35, 500, 2600, peak=0.5), 0.14)
            mix.put(h["t"] + 0.3, chime([C5, E5, G5, C6], 2.0, 0.8), 0.16)
            mix.put(h["t"] + 0.05, blip(G5, 0.3, 0.1), 0.1)
    mix.master(-20.0)
    mix.write(out)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
