"""The single-take reel: a quiet bed under the voice, and sound on every motion.

Bed: a C major pad (Cmaj7, Am7, Fmaj7, G) and a soft pulse at 96 BPM, ducked under the voice
(from the word times), held back on the odds-drop build, swelling into the end card.
Motion: a whoosh as each card springs in or leaves, a lighter swish when its content slides,
a tick on each beat label, keystrokes while the repo is typed, a blip when a judge's question
lands, a riser and one hard impact on the odds drop, a resolved chime on the end card.

Run by scripts/reel-final.ts: python -m sfx.cues.reel_final <events.json> <out.wav>
The stem is mastered to -20 LUFS so the voice leads; the whole reel is mastered to -14.
"""

import json
import random
import sys

from sfx.mix import Mix
from sfx.synth import blip, chime, click, envelope, impact, key, pad, pop, riser, whoosh

C3, E3, G3, A3, B3 = 130.81, 164.81, 196.0, 220.0, 246.94
C4, D4, E4, F4, G4, A4 = 261.63, 293.66, 329.63, 349.23, 392.0, 440.0
C5, E5, G5, A5, C6, E6 = 523.25, 659.25, 783.99, 880.0, 1046.5, 1318.5
BPM = 96


def main(src, out):
    with open(src, encoding="utf-8") as f:
        ev = json.load(f)
    dur = ev["duration"]
    mix = Mix(dur + 0.6)
    random.seed(7)

    # ---------------------------------------------------------------- the bed
    end_at = ev["end"]
    drops = ev["drops"]
    # Ducking: the bed sits low under speech and comes up in the gaps and on the end card.
    pts = [(0.0, 0.0), (0.6, 0.5)]
    for w in ev["words"]:
        pts += [(w["start"] - 0.05, 0.42), (w["end"] + 0.05, 0.42)]
    for d in drops:
        pts += [(d - 0.7, 0.42), (d - 0.05, 0.12), (d + 0.25, 0.6), (d + 0.9, 0.42)]
    pts += [(end_at - 0.1, 0.5), (end_at + 0.4, 1.0), (dur - 0.8, 1.0), (dur + 0.4, 0.0)]
    vol = envelope(pts)
    chords = [(0.0, [C3, E3, G3, B3]), (dur * 0.25, [A3, C4, E4, G4]), (dur * 0.5, [F4 / 2, A3, C4, E4]), (dur * 0.75, [G3, B3, D4, G4]), (end_at, [C3, G3, C4, E4])]
    left, right = pad(dur + 0.4, chords, volume=vol, detune=0.8, tremolo=0.18)
    mix.put_stereo(0.0, left, right, 0.05)

    # A soft pulse from the second line, out for the drop's build, gone on the end card.
    beat = 60 / BPM
    t = ev["pulseFrom"]
    n = 0
    while t < end_at - 0.05:
        if not any(d - 0.75 < t < d + 0.1 for d in drops):
            g = vol(t)
            mix.put(t, impact(0.28), 0.07 * g, pan=0)
            if n % 2 == 1:
                mix.put(t + beat / 2, click(9000, 0.015), 0.025 * g, pan=0.35)
        t += beat
        n += 1

    # ---------------------------------------------------------------- motion
    for c in ev["cardIn"]:
        mix.put(c - 0.12, whoosh(0.4, 350, 2400, peak=0.55), 0.13, pan=-0.1)
        mix.put(c + 0.2, pop(G4, C5, 0.12), 0.05)
    for c in ev["cardOut"]:
        mix.put(c - 0.2, whoosh(0.3, 2600, 500, peak=0.4), 0.08, pan=0.1)
    for c in ev["swap"]:
        mix.put(c - 0.06, whoosh(0.22, 900, 3200, peak=0.5), 0.07, pan=0.3)
    for i, c in enumerate(ev["labels"]):
        mix.put(c + 0.14, click(2200 + 120 * (i % 4), 0.03), 0.06, pan=-0.35)
    for k in ev["keys"]:
        mix.put(k, key(), random.uniform(0.03, 0.05), pan=-0.2)
    for q in ev["questions"]:
        mix.put(q, blip(E5, 0.3, 0.1), 0.05, pan=0.2)
    for d in drops:
        mix.put(d - 0.7, riser(0.7, 260, 3400), 0.08)
        mix.put(d, impact(1.1), 0.36)
        mix.put(d, pop(A5, E5, 0.22), 0.14, pan=0.3)
    for p in ev["punches"]:
        mix.put(p - 0.03, whoosh(0.18, 600, 1800, peak=0.7), 0.04)

    # ---------------------------------------------------------------- the end card
    mix.put(end_at - 0.1, whoosh(0.5, 300, 2800, peak=0.5), 0.12)
    mix.put(end_at + 0.05, pop(G5, C6, 0.16), 0.14)
    mix.put(end_at + 0.3, chime([C5, E5, G5, C6], 2.6, 0.9), 0.16)
    for i in range(3):
        mix.put(end_at + 0.5 + i * 0.08, blip([E5, G5, C6][i], 0.25, 0.08), 0.05, pan=-0.3 + 0.3 * i)

    mix.master(-20.0)
    mix.write(out)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
