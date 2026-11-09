"""An original music bed for the launch video, synthesized (no samples, nothing to license).

Minimal electronic, 100 BPM, A minor (Am - F - C - G, a bar each). It's arranged to the
video's timeline (src/v2/timeline.json), whose beats are this track's beats:
  intro (hook)          pad and soft hats
  "would this win?"     kick and sub bass come in on the slam
  the scan              16th hats, a low-pass opening up; kick out for the last bar (the riser lives in the SFX)
  the odds drop         everything back on the hit, plus a crash
  the Tired Judge       one beat of silence, then back on the jolt
  end card              the last chord rings out, a soft fade
Writes audio/build/music.wav (48 kHz stereo float, unmastered: the mixer sets levels).
"""

import json
from pathlib import Path

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parent.parent
SR = 48000
rng = np.random.default_rng(7)


def note(n: str) -> float:
    names = {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11}
    pitch, octave = n[:-1], int(n[-1])
    return 440.0 * 2 ** ((names[pitch] + 12 * (octave + 1) - 69) / 12)


CHORDS = [  # (bass root, pad voicing) per bar
    ("A1", ["A3", "C4", "E4", "B4"]),
    ("F1", ["F3", "A3", "C4", "E4"]),
    ("C2", ["C3", "G3", "E4", "B4"]),
    ("G1", ["G3", "B3", "D4", "A4"]),
]


def onepole_lp(x: np.ndarray, cutoff: np.ndarray) -> np.ndarray:
    """One-pole low-pass with a per-sample cutoff (Hz)."""
    a = 1 - np.exp(-2 * np.pi * np.clip(cutoff, 20, SR / 2.5) / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc += a[i] * (x[i] - acc)
        y[i] = acc
    return y


def kick(dur=0.42):
    t = np.arange(int(dur * SR)) / SR
    f = 46 + 110 * np.exp(-t / 0.035)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t / 0.16)
    click = rng.uniform(-1, 1, len(t)) * np.exp(-t / 0.002) * 0.25
    return np.tanh(1.4 * (body + click))


def hat(dur=0.05, open_=False):
    n = int((0.22 if open_ else dur) * SR)
    t = np.arange(n) / SR
    x = rng.uniform(-1, 1, n)
    x = x - np.concatenate([[0], x[:-1]])  # crude high-pass: just the sizzle
    return x * np.exp(-t / (0.06 if open_ else 0.012)) * 0.5


def crash(dur=1.6):
    t = np.arange(int(dur * SR)) / SR
    x = rng.uniform(-1, 1, len(t))
    x = x - 0.6 * np.concatenate([[0], x[:-1]])
    return x * np.exp(-t / 0.45) * 0.35


def main():
    tl = json.loads((ROOT / "src" / "v2" / "timeline.json").read_text())
    beats = tl["beats"]
    S = tl["scenes"]
    period = 60 / tl["bpm"]
    dur = tl["duration"] + 1.5
    n = int(dur * SR)
    L = np.zeros(n)
    R = np.zeros(n)
    t = np.arange(n) / SR

    slam, drop, end_card = S["1b"]["slam"], S["3b"]["drop"], S["9"]["start"]
    riser0 = S["3a"]["riserStart"]
    pause0, pause1 = S["6"]["pause"]
    last_chord = S["9"]["logoLand"]

    def put(x, at, gain=1.0, pan=0.0):
        i = int(round(at * SR))
        if i >= n:
            return
        x = x[: n - i]
        L[i : i + len(x)] += x * gain * np.sqrt(0.5 * (1 - pan))
        R[i : i + len(x)] += x * gain * np.sqrt(0.5 * (1 + pan))

    bar_of = lambda time: int(time // (4 * period))

    # Pad: detuned saw-ish stack through a low-pass that opens across the scan and stays open.
    pad = np.zeros(n)
    padR = np.zeros(n)
    for bar in range(int(dur // (4 * period)) + 1):
        t0 = bar * 4 * period
        chord = CHORDS[bar % 4][1] if t0 < last_chord - 1e-6 else ["A3", "C4", "E4", "B4"]
        i0, i1 = int(t0 * SR), min(n, int((t0 + 4 * period + 0.3) * SR))
        if t0 >= last_chord:
            i1 = n  # the last chord rings out
        tt = np.arange(i1 - i0) / SR
        env = np.minimum(1, tt / 0.25) * (np.minimum(1, (i1 - i0) / SR - tt) / 0.3 if i1 != n else 1)
        env = np.clip(env, 0, 1)
        for j, nm in enumerate(chord):
            f = note(nm)
            for det, ch in ((-0.18, pad), (0.18, padR)):
                ph = 2 * np.pi * (f * (1 + det / 100)) * tt
                wave = np.sin(ph) + 0.3 * np.sin(2 * ph) + 0.12 * np.sin(3 * ph)
                ch[i0:i1] += wave * env * (0.16 / (1 + 0.4 * j))
    cutoff = np.where(t < slam, 900, np.where(t < riser0 - 4 * period, 1400, 1400 + 4600 * np.clip((t - (riser0 - 4 * period)) / (drop - riser0 + 4 * period), 0, 1)))
    cutoff = np.where(t >= drop, 3200, cutoff)
    cutoff = np.where(t >= last_chord, 2600 * np.exp(-(t - last_chord) / 3) + 600, cutoff)
    L += onepole_lp(pad, cutoff) * 0.9
    R += onepole_lp(padR, cutoff) * 0.9

    # Drums and bass on the grid.
    k = kick()
    for i, b in enumerate(beats):
        if b >= last_chord + 1e-6:
            break
        bar = bar_of(b)
        silent = pause0 - 1e-6 <= b < pause1 - 1e-6
        if silent:
            continue
        # Hats: 8ths from the start; 16ths through the scan build.
        build = riser0 - 4 * period <= b < drop
        steps = 4 if build else 2
        for s in range(steps):
            at = b + s * period / steps
            if pause0 - 1e-6 <= at < pause1 - 1e-6:
                continue
            put(hat(open_=(s == steps // 2 and not build)), at, 0.16 if s % 2 else 0.09, pan=0.25)
        if b < slam - 1e-6:
            continue
        # Kick: four on the floor from the slam; out for the last bar before the drop.
        if not (riser0 <= b < drop - 1e-6):
            put(k, b, 0.85)
        # Sub bass on the off-beats, the bar's root.
        if not (riser0 <= b < drop - 1e-6):
            root = note(CHORDS[bar % 4][0])
            bt = np.arange(int(period * 0.45 * SR)) / SR
            bass = np.sin(2 * np.pi * root * 2 * bt) * np.minimum(1, bt / 0.01) * np.exp(-bt / 0.22)
            put(np.tanh(1.5 * bass), b + period / 2, 0.42)
    put(crash(), drop, 0.9)
    put(k, drop, 1.0)

    # Silence means silence: one clean beat out, short fades so nothing clicks.
    for a, b_ in ((pause0, pause1),):
        i0, i1 = int(a * SR), int(b_ * SR)
        fade = int(0.012 * SR)
        g = np.ones(n)
        g[i0 - fade : i0] = np.linspace(1, 0, fade)
        g[i0:i1] = 0
        g[i1 : i1 + fade] = np.linspace(0, 1, fade)
        L *= g
        R *= g

    # Sidechain pump: the pad dips a little under each kick (the classic breath).
    # Then the bed fades out after the end card's chord.
    out_fade = np.clip(1 - (t - (tl["duration"] - 0.9)) / 1.2, 0, 1)
    L *= out_fade
    R *= out_fade
    st = np.stack([L, R], axis=1)
    st /= max(1e-9, np.abs(st).max()) / 0.8
    (ROOT / "audio" / "build").mkdir(parents=True, exist_ok=True)
    sf.write(ROOT / "audio" / "build" / "music.wav", st.astype(np.float32), SR, subtype="FLOAT")
    print(f"music.wav: {dur:.1f}s, {tl['bpm']} bpm, drop at {drop:.2f}s, pause {pause0:.2f}-{pause1:.2f}s")


if __name__ == "__main__":
    main()
