"""v3 sound: one stem per edit in src/v3/edits.json, no music, C major throughout.

Every time comes from the edit (cuts, caption starts) or from the capture's per-frame meta
(public/capture/v3/*.json: odds changes, keystrokes, dictated words), mapped through each
shot's `from` and `rate`. Nothing is placed by hand, so picture and sound can't drift.

Run: python -m sfx.cues.v3 [edit-id ...]   (default: every edit)  -> out/v3/sfx/<id>.wav
"""

import json
import os
import sys

from sfx.mix import Mix
from sfx.synth import blip, chime, click, impact, key, pop, riser, whoosh

EDITS = "src/v3/edits.json"
META = "public/capture/v3/{clip}.json"
OUT = "out/v3/sfx/{id}.wav"

C5, E5, G5, A5, C6, E6, G6 = 523.25, 659.25, 783.99, 880.0, 1046.5, 1318.5, 1567.98
C3, G3 = 130.81, 196.0

_meta = {}


def meta(clip):
    if clip not in _meta:
        with open(META.format(clip=clip), encoding="utf-8") as f:
            _meta[clip] = json.load(f)["frames"]
    return _meta[clip]


def events(shot, start):
    """What happens inside a shot, as (time in the edit, kind, value)."""
    frames = meta(shot["clip"])
    rate = shot.get("rate", 1)
    f0 = round(shot["from"] * 30)
    f1 = min(len(frames) - 1, round((shot["from"] + shot["dur"] * rate) * 30))
    out = []
    at = lambda f: start + (f / 30 - shot["from"]) / rate
    for f in range(max(1, f0), f1 + 1):
        a, b = frames[f - 1], frames[f]
        if a["odds"] and b["odds"] and a["odds"] != b["odds"]:
            out.append((at(f), "odds", int(b["odds"]) - int(a["odds"])))
        if b["typed"] > a["typed"]:
            out.append((at(f), "key", b["typed"] - a["typed"]))
        if b["answer"] > a["answer"]:
            # A dictated word lands: the box grows by a word's worth of characters.
            out.append((at(f), "word", b["answer"] - a["answer"]))
        if a["answer"] == 0 and b["answer"] > 0:
            out.append((at(f), "mic", 0))
    return out


def score(spec):
    items = spec["items"]
    total = sum(i["dur"] for i in items)
    mix = Mix(total + 0.6)
    t = 0.0
    hero_used = False
    for n, it in enumerate(items):
        if "card" in it:
            # The end card: a soft arrival into the logo, then the chime as the URL lands.
            mix.put(t - 0.08, whoosh(0.35, 500, 2600, peak=0.5), 0.16)
            mix.put(t + 0.02, pop(G5, C6, 0.16), 0.22)
            mix.put(t + 0.3, chime([C5, E5, G5, C6], 2.2, 0.8), 0.2)
            t += it["dur"]
            continue
        if n > 0:
            # Hard cut: a short air tick, never a swoosh template.
            mix.put(t - 0.03, whoosh(0.16, 1400, 3600, peak=0.3), 0.07, pan=0.1)
        cap = it.get("caption")
        if cap:
            mix.put(t + max(0, cap.get("at", 0)), blip(E6 if n % 2 else G5, 0.22, 0.07), 0.05, pan=-0.3)
        for when, kind, v in events(it, t):
            if when < t or when > t + it["dur"]:
                continue
            if kind == "odds" and v < 0:
                big = v <= -15
                if not hero_used and big and not spec.get("bare"):
                    # The one hero hit per video: a riser into the biggest drop.
                    mix.put(max(0, when - 0.9), riser(0.9, 300, 3200), 0.06)
                    mix.put(when, impact(0.9), 0.3)
                    hero_used = True
                else:
                    mix.put(when, impact(0.5), 0.18)
                mix.put(when, pop(A5, E5, 0.18), 0.16, pan=0.5)
            elif kind == "odds" and v > 0:
                mix.put(when, pop(G5, C6, 0.16), 0.17, pan=0.5)
                mix.put(when + 0.06, blip(E6, 0.35, 0.12), 0.08, pan=0.5)
            elif kind == "key":
                mix.put(when, key(), 0.12, pan=-0.2)
            elif kind == "mic":
                mix.put(when - 0.3, click(1800), 0.14, pan=-0.3)
            elif kind == "word" and v >= 3:
                mix.put(when, click(2600, 0.03), 0.035, pan=-0.25)
        t += it["dur"]
    return mix


def main(ids):
    with open(EDITS, encoding="utf-8") as f:
        edits = json.load(f)
    for id_ in ids or [k for k in edits if not k.startswith("v3-style")]:
        mix = score(edits[id_])
        info = mix.master(-14.0)
        path = OUT.format(id=id_)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        mix.write(path)
        print(f"{id_}: {path}  {info['lufs']:.1f} LUFS  peak {info['peak_db']:.1f} dB  drive {info['drive']}")


if __name__ == "__main__":
    main(sys.argv[1:])
