"""The launch video's sound: voice, music and effects, each placed from src/v2/timeline.json.

  voice    Kokoro lines (audio/voice/line-N.wav), lightly processed: high-pass, a touch of
           presence, gentle compression. Nothing that makes it sound processed.
  effects  synthesized with claude-motion's generators (audio_engine/cm_synth.py), every
           cue tied to something moving on screen.
  music    audio/music.mp3 if it exists (trimmed to the detected beat window), else the
           synthesized bed (audio/build/music.wav).

Sidechain: the music ducks about 8 dB under the voice and dips hard under the three impacts
(the slam, the odds drop, the jolt), so every hit cuts through. Effects are kept below the
music's own peaks. Writes audio/build/mix-{vo,novo,ig}.wav (unmastered; render_v2.ts
masters each to its loudness target after muxing).
"""

import json
import random
import subprocess
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from audio_engine import cm_synth as syn  # noqa: E402

SR = 48000
FFMPEG = str(ROOT / "node_modules" / "ffmpeg-static" / "ffmpeg.exe")
BUILD = ROOT / "audio" / "build"
# A minor, to match the bed.
A = {"A3": 220.0, "C4": 261.63, "E4": 329.63, "G4": 392.0, "A4": 440.0, "B4": 493.88, "C5": 523.25, "E5": 659.25, "A5": 880.0}


def arr(x):
    return np.asarray(x, dtype=np.float64)


class Stem:
    def __init__(self, seconds: float):
        self.n = int(seconds * SR)
        self.L = np.zeros(self.n)
        self.R = np.zeros(self.n)

    def put(self, t: float, x, gain=1.0, pan=0.0):
        x = arr(x)
        i = int(round(t * SR))
        if i < 0:
            x, i = x[-i:], 0
        x = x[: max(0, self.n - i)]
        self.L[i : i + len(x)] += x * gain * np.sqrt(0.5 * (1 - pan))
        self.R[i : i + len(x)] += x * gain * np.sqrt(0.5 * (1 + pan))

    def stereo(self):
        return np.stack([self.L, self.R], axis=1)


def process_voice(line: str) -> np.ndarray:
    """Gentle: rumble off, a little less mud, a little more presence, light compression."""
    out = BUILD / f"voice-{line}.wav"
    af = "aresample=48000,highpass=f=85,equalizer=f=260:t=q:w=1.1:g=-1.5,equalizer=f=3300:t=q:w=1.3:g=2.2,acompressor=threshold=-21dB:ratio=2.4:attack=8:release=110:makeup=1.5"
    subprocess.run([FFMPEG, "-hide_banner", "-loglevel", "error", "-y", "-i", str(ROOT / "audio" / "voice" / f"line-{line}.wav"), "-af", af, "-ac", "1", str(out)], check=True)
    x, _ = sf.read(out)
    return x


def follower(x: np.ndarray, attack: float, release: float) -> np.ndarray:
    """Envelope follower on |x| with separate attack/release (seconds)."""
    a = np.exp(-1 / (attack * SR))
    r = np.exp(-1 / (release * SR))
    env = np.empty_like(x)
    acc = 0.0
    for i, v in enumerate(np.abs(x)):
        c = a if v > acc else r
        acc = c * acc + (1 - c) * v
        env[i] = acc
    return env


def short_term_peak(st: np.ndarray, win=0.1) -> float:
    m = (st**2).mean(axis=1)
    k = int(win * SR)
    c = np.convolve(m, np.ones(k) / k, mode="same")
    return float(np.sqrt(c.max()))


def effects(tl, dur) -> Stem:
    random.seed(11)
    S = tl["scenes"]
    fx = Stem(dur)
    wipes = [S["2"]["start"], S["6"]["start"], S["7"]["start"]]
    zooms = [(S["2"]["press"] + 0.12, S["3a"]["start"]), (S["9"]["start"] - 0.4, S["9"]["start"])]

    # 1b: a whoosh into the slam, and a low thump on it.
    fx.put(S["1b"]["slam"] - 0.32, syn.whoosh(0.32, 3200, 500, peak=0.85), 0.16)
    fx.put(S["1b"]["slam"], syn.pop(140, 48, dur=0.35), 0.5)
    # Mask wipes and zoom-throughs: air.
    for t in wipes:
        fx.put(t - 0.3, syn.whoosh(0.36, 600, 2600, peak=0.7), 0.13, pan=-0.2)
    for t0, t1 in zooms:
        fx.put(t0, syn.whoosh(t1 - t0 + 0.1, 400, 4200, peak=0.8), 0.16)
    # 2: the repo, typed; the press.
    s2 = S["2"]
    for c in range(31):
        fx.put(s2["typeStart"] + c * s2["typeCharSec"] + random.uniform(-0.004, 0.004), syn.key(), random.uniform(0.13, 0.2), pan=0.15)
    fx.put(s2["press"], syn.click(900, 0.06), 0.3)
    fx.put(s2["press"] + 0.01, syn.blip(A["A3"], 0.25, 0.06), 0.08)
    # 3a: files tick in, beams whoosh, the third beam's error, the riser into the drop.
    s3 = S["3a"]
    for i in range(11):
        fx.put(s3["cascade"] + i * s3["cascadeStagger"], syn.click(2600 + 90 * i, 0.03), 0.07, pan=-0.3 + i * 0.05)
    for i, b in enumerate(s3["beams"]):
        fx.put(b, syn.whoosh(s3["beamSec"], 900, 3600, peak=0.4, q=1.1), 0.08, pan=0.35)
    fx.put(s3["red"], syn.blip(A["E4"], 0.18, 0.05), 0.14)
    fx.put(s3["red"] + 0.11, syn.blip(A["C4"] * 0.5 * 2, 0.32, 0.09), 0.14)
    drop = S["3b"]["drop"]
    fx.put(s3["riserStart"], syn.riser(drop - s3["riserStart"]), 0.2)
    # 3b: the one impact.
    fx.put(drop, syn.impact(1.3), 0.42)
    # 4: three judges slide in, left to right; the punch-in; the question ticks in word by word.
    s4 = S["4"]
    for i, t in enumerate(s4["slide"]):
        fx.put(t - 0.05, syn.whoosh(0.28, 700, 2400, peak=0.6), 0.09, pan=-0.5 + i * 0.5)
    fx.put(s4["punch"], syn.pop(180, 70, 0.2), 0.32)
    for w in range(14):
        fx.put(s4["qStart"] + w * s4["qWordSec"], syn.click(3200, 0.02), 0.045)
    # 5: the answer typed (every other key: it's fast), soft, because 6b is spoken over it; the
    # Investor's punch-in; the odds tick up.
    s5 = S["5"]
    for c in range(0, 84, 2):
        fx.put(s5["typeStart"] + c * s5["typeCharSec"] + random.uniform(-0.003, 0.003), syn.key(), random.uniform(0.05, 0.08), pan=0.1)
    fx.put(s5["punch"], syn.pop(180, 70, 0.2), 0.22)
    fx.put(s5["tick"], syn.pop(660, 1320, 0.16), 0.2)
    fx.put(s5["tick"] + 0.02, syn.blip(A["E5"], 0.4, 0.12), 0.1)
    # 6: the jolt awake.
    s6 = S["6"]
    fx.put(s6["jolt"], syn.pop(300, 1200, 0.14), 0.26)
    fx.put(s6["jolt"] - 0.02, syn.whoosh(0.18, 1200, 4800, peak=0.3), 0.1)
    # 7: a pop per bubble, rising in key; the typing dots.
    notes = [A["A4"], A["C5"], A["E5"], A["A5"]]
    for i, t in enumerate(S["7"]["bubbles"]):
        fx.put(t, syn.pop(notes[i] * 0.75, notes[i], 0.14), 0.14, pan=-0.2 + 0.13 * i)
    fx.put(S["7"]["typing"], syn.click(4200, 0.025), 0.05)
    # 8: the card flips in; each fix ticks.
    s8 = S["8"]
    fx.put(s8["flip"] - 0.05, syn.whoosh(0.4, 500, 2000, peak=0.5), 0.14)
    fx.put(s8["flip"] + 0.32, syn.click(700, 0.06), 0.16)
    for i, t in enumerate(s8["fixes"]):
        fx.put(t, syn.click(2200, 0.04), 0.1)
        fx.put(t, syn.blip([A["A4"], A["C5"], A["E5"]][i], 0.25, 0.07), 0.05)
    # 9: the mark assembles (braces slide, the hook pops, the dot lands), then the resolve.
    s9 = S["9"]
    fx.put(s9["logo"], syn.whoosh(0.3, 800, 2600, peak=0.5), 0.07, pan=-0.4)
    fx.put(s9["logo"] + 0.05, syn.whoosh(0.3, 800, 2600, peak=0.5), 0.07, pan=0.4)
    fx.put(s9["logo"] + 0.45, syn.pop(220, 660, 0.16), 0.12)
    fx.put(s9["logoLand"] - 0.12, syn.click(1500, 0.05), 0.1)
    fx.put(s9["logoLand"], syn.chime([A["A4"], A["C5"], A["E5"], A["B4"] * 2], dur=2.6, tau=0.9), 0.1)
    fx.put(s9["url"], syn.whoosh(0.3, 1500, 4000, peak=0.5), 0.05)
    return fx


def main():
    tl = json.loads((ROOT / "src" / "v2" / "timeline.json").read_text())
    dur = tl["duration"]
    BUILD.mkdir(parents=True, exist_ok=True)

    # Voice.
    vo = Stem(dur)
    for line, v in tl["voice"].items():
        vo.put(v["start"], process_voice(line), 1.0)
    voice = vo.stereo()

    # Music: a real track if there is one (trimmed to its beat window), else the bed.
    track = ROOT / "audio" / "music.mp3"
    beats = json.loads((ROOT / "audio" / "beats.json").read_text())
    if track.exists() and beats["source"] == "detected":
        raw = subprocess.run([FFMPEG, "-v", "error", "-ss", str(beats["trackStart"]), "-i", str(track), "-t", str(dur), "-ac", "2", "-ar", str(SR), "-f", "f32le", "-"], check=True, capture_output=True).stdout
        music = np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).astype(np.float64)
        fade = np.clip(np.arange(len(music)) / (0.05 * SR), 0, 1) * np.clip((len(music) - np.arange(len(music))) / (1.2 * SR), 0, 1)
        music *= fade[:, None]
    else:
        music, _ = sf.read(BUILD / "music.wav")
    music = np.pad(music, ((0, max(0, vo.n - len(music))), (0, 0)))[: vo.n]

    fx = effects(tl, dur).stereo()

    # Sidechain gains.
    t = np.arange(vo.n) / SR
    v_env = follower(voice.mean(axis=1), 0.04, 0.35)
    v_on = np.clip(v_env / 0.02, 0, 1)
    duck_voice = 1 - 0.6 * v_on  # about -8 dB under the voice
    S = tl["scenes"]
    hits = [S["1b"]["slam"], S["3b"]["drop"], S["6"]["jolt"]]
    duck_hits = np.ones(vo.n)
    for h in hits:
        rel = t - h
        dip = np.where(rel < -0.02, 1, np.where(rel < 0, 1 - 0.7 * (rel + 0.02) / 0.02, 0.3 + 0.7 * (1 - np.exp(-np.maximum(rel, 0) / 0.18))))
        duck_hits = np.minimum(duck_hits, dip)

    MUSIC_GAIN = 0.5
    m_peak = short_term_peak(music * MUSIC_GAIN)
    fx_gain = min(1.0, 0.92 * m_peak / max(1e-9, short_term_peak(fx)))

    mixes = {
        "vo": voice + music[:, :] * MUSIC_GAIN * (duck_voice * duck_hits)[:, None] + fx * fx_gain,
        "novo": music * MUSIC_GAIN * duck_hits[:, None] + fx * fx_gain,
        "ig": voice + fx * fx_gain,
    }
    for name, m in mixes.items():
        sf.write(BUILD / f"mix-{name}.wav", m.astype(np.float32), SR, subtype="FLOAT")
    sf.write(BUILD / "stem-voice.wav", voice.astype(np.float32), SR, subtype="FLOAT")
    sf.write(BUILD / "stem-music.wav", (music * MUSIC_GAIN).astype(np.float32), SR, subtype="FLOAT")
    sf.write(BUILD / "stem-fx.wav", (fx * fx_gain).astype(np.float32), SR, subtype="FLOAT")
    print(f"mixes written ({dur:.2f}s). effects gain {fx_gain:.2f} (kept under the music's short-term peak {m_peak:.3f})")


if __name__ == "__main__":
    main()
