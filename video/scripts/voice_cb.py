"""The launch voiceover, v3: performed, not read. Generated locally with Resemble AI's
Chatterbox (MIT, runs on the CPU, no cloud). Unlike Kokoro it samples, so the same line comes
out differently each time, and it takes direction: `exaggeration` (how much emotion) and
`cfg` (lower = looser, more natural pacing). So each line gets its own direction, a few takes
are generated, and scripts/voice_pick.py keeps the best one (words right, most pitch life,
on length).

    .venv-tts/Scripts/python scripts/voice_cb.py samples   # one line, several directions -> audio/voice-samples/v3/
    .venv-tts/Scripts/python scripts/voice_cb.py lines     # TAKES takes of every line -> audio/voice/takes/

The narrator's timbre and energy come from a reference clip (REF): by default an animated
passage spoken by Kokoro's am_puck (audio/voice-samples/ref/, a synthetic voice, Apache-2.0),
so no real person's voice is cloned. It was picked for being low and male with the widest
pitch movement of Kokoro's male voices (12 st vs am_michael's 7.7; scripts/pitch_stats.py).
"""

import json
import os
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
import torch

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from script_v3 import LINES  # noqa: E402

_ref = os.environ.get("REF", str(ROOT / "audio" / "voice-samples" / "ref" / "am_puck.wav"))
REF = Path(_ref) if _ref else None  # REF= (empty) uses Chatterbox's built-in voice
TAKES = int(os.environ.get("TAKES", "4"))
ENGINE = os.environ.get("ENGINE", "standard")  # standard | turbo


def load():
    if ENGINE == "turbo":
        from chatterbox.tts_turbo import ChatterboxTurboTTS

        return ChatterboxTurboTTS.from_pretrained(device="cpu")
    from chatterbox.tts import ChatterboxTTS

    return ChatterboxTTS.from_pretrained(device="cpu")


def say(model, text: str, exaggeration: float, cfg: float, seed: int) -> np.ndarray:
    torch.manual_seed(seed)
    np.random.seed(seed)
    kw = dict(audio_prompt_path=str(REF)) if REF else {}
    if ENGINE != "turbo":
        kw.update(exaggeration=exaggeration, cfg_weight=cfg, temperature=0.8)
    wav = model.generate(text, **kw)
    a = wav.squeeze(0).detach().cpu().numpy().astype(np.float32)
    # Trim the model's own leading/trailing silence (the timeline sets the gaps).
    # Generous pre-roll: soft onsets ("h", "p") sit under the threshold and must survive.
    on = np.nonzero(np.abs(a) > 0.012)[0]
    if len(on):
        a = a[max(0, on[0] - int(0.12 * model.sr)) : min(len(a), on[-1] + int(0.12 * model.sr))]
    return a


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "lines"
    only = set(sys.argv[2].split(",")) if len(sys.argv) > 2 else None
    torch.set_num_threads(max(1, (os.cpu_count() or 4) - 2))
    model = load()
    if mode == "samples":
        out = ROOT / "audio" / "voice-samples" / "v3"
        out.mkdir(parents=True, exist_ok=True)
        line = LINES["6c"]
        for ex, cfg in [(0.5, 0.5), (0.7, 0.35), (0.9, 0.3)]:
            a = say(model, line["spoken"], ex, cfg, 1)
            sf.write(out / f"6c-ex{ex}-cfg{cfg}-{ENGINE}-{REF.stem if REF else 'builtin'}.wav", a, model.sr)
            print(f"ex {ex} cfg {cfg}: {len(a) / model.sr:.2f}s")
        return
    out = ROOT / "audio" / "voice" / "takes"
    out.mkdir(parents=True, exist_ok=True)
    meta = json.loads((out / "takes.json").read_text()) if (out / "takes.json").exists() else {}
    for lid, line in LINES.items():
        if only and lid not in only:
            continue
        meta[lid] = []
        for k in range(TAKES):
            a = say(model, line["spoken"], line["ex"], line["cfg"], 100 + k)
            p = out / f"line-{lid}-take{k}.wav"
            sf.write(p, a, model.sr)
            meta[lid].append({"file": p.name, "seconds": round(len(a) / model.sr, 3)})
            print(f"{lid} take {k}: {len(a) / model.sr:.2f}s", flush=True)
        (out / "takes.json").write_text(json.dumps(meta, indent=1))


if __name__ == "__main__":
    main()
