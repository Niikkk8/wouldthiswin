"""Median F0 and pitch spread (10th-90th percentile, semitones) of WAVs: a stand-in for
listening when judging how animated a voice is. Shortest-lag autocorrelation (no octave-down errors)."""
import sys
import numpy as np
import soundfile as sf


def f0s(x, sr):
    if x.ndim > 1:
        x = x.mean(axis=1)
    hop, win = int(0.02 * sr), int(0.04 * sr)
    lo, hi = int(sr / 400), int(sr / 70)
    out = []
    for i in range(0, len(x) - win - hi, hop):
        f = x[i : i + win + hi]
        if np.sqrt(np.mean(f[:win] ** 2)) < 0.03:
            continue
        a = f[:win] - f[:win].mean()
        cs = np.array([np.dot(a, f[L : L + win] - f[L : L + win].mean()) / (np.linalg.norm(a) * np.linalg.norm(f[L : L + win] - f[L : L + win].mean()) + 1e-9) for L in range(lo, hi)])
        if cs.max() < 0.6:
            continue
        out.append(sr / (lo + np.argmax(cs >= 0.85 * cs.max())))
    return np.array(out)


def stats(path):
    x, sr = sf.read(path)
    v = f0s(x, sr)
    st = 12 * np.log2(v / np.median(v))
    return float(np.median(v)), float(np.percentile(st, 90) - np.percentile(st, 10))


if __name__ == "__main__":
    for p in sys.argv[1:]:
        m, s = stats(p)
        print(f"{p.replace(chr(92), '/').split('/')[-1]:40s} median {m:4.0f} Hz  spread {s:4.1f} st")
