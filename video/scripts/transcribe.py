"""Transcribes audio locally with faster-whisper, with word timestamps.

Usage: python transcribe.py <out.json> <audio.wav> [<audio.wav> ...]
Writes {"<audio path>": [{"start", "end", "word", "p"}, ...], ...}.
Model: WHISPER_MODEL env (default small.en), CPU int8. Downloads once to the HF cache.
"""

import json
import os
import sys
import wave

os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")

import numpy as np
from faster_whisper import WhisperModel


def load(path: str) -> np.ndarray:
    """The 16kHz mono 16-bit WAV the pipeline extracts, as float32 (no PyAV needed)."""
    with wave.open(path, "rb") as w:
        assert w.getframerate() == 16000 and w.getnchannels() == 1 and w.getsampwidth() == 2, "expects 16kHz mono s16 wav"
        return np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768.0


def main() -> None:
    out, files = sys.argv[1], sys.argv[2:]
    model = WhisperModel(os.environ.get("WHISPER_MODEL", "small.en"), device="cpu", compute_type="int8")
    result = {}
    for path in files:
        segments, _ = model.transcribe(
            load(path),
            language="en",
            word_timestamps=True,
            vad_filter=True,
            vad_parameters={"min_silence_duration_ms": 400},
            condition_on_previous_text=False,
            beam_size=5,
            # Whisper leaves out "um" and "uh" unless the prompt has some: keep them, so a
            # take with fillers can lose to a clean one.
            initial_prompt="Umm, let me think, uh... so, um, okay. Hmm.",
        )
        words = []
        for seg in segments:
            for w in seg.words or []:
                words.append({"start": round(w.start, 3), "end": round(w.end, 3), "word": w.word.strip(), "p": round(w.probability, 3)})
        result[path] = words
        print(f"  {os.path.basename(path)}: {len(words)} words", flush=True)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=1)


if __name__ == "__main__":
    main()
