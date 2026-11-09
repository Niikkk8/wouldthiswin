"""Writes the iteration SVGs and the final motion-ready logo.svg from fit_glyphs.py's fits.

Final geometry: "{?}" in Archivo 900, one shared scale and baseline (it's one text run),
each glyph's x refit with that shared scale (the logo's own tracking). Parts are separate
elements with stable ids so they can be choreographed: #brace-left, #question-hook,
#question-dot, #brace-right.

Usage: python make_svg.py <logo.png> <work_dir> <out_dir>
"""

import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from fit_glyphs import contours, faces, load_targets, raster, region, soft_iou, split_contours, svg_path  # noqa: E402

BRACE = "#f5f5f4"
RED = "#ff3b30"
W, H = 91, 66


def svg(parts, title):
    body = "\n".join(f'  <path id="{pid}" fill="{fill}" d="{d}"/>' for pid, fill, d in parts)
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">\n  <title>{title}</title>\n{body}\n</svg>\n'


def parts_for(font, glyphs, fits):
    out = []
    for key, ch in glyphs:
        _, name = contours(font, ch)
        s, sx, tx, ty = fits[key]
        d = svg_path(font, name, s, sx, tx, ty)
        fill = RED if key == "question" else BRACE
        if key == "question":
            # Two contours: the hook (bigger) and the dot. Order them by vertical position.
            cs = split_contours(d)
            ys = [float(c.split()[0][1:].split("V")[0].split("H")[0].split("Q")[0].split("L")[0].split(",")[-1]) if False else 0 for c in cs]
            hook, dot = sorted(cs, key=len, reverse=True)[:2]
            out += [("question-hook", fill, hook), ("question-dot", fill, dot)]
        else:
            out.append((key, fill, d))
    return out


def main():
    png, work, outdir = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
    (outdir / "fit_iterations").mkdir(parents=True, exist_ok=True)
    cands = json.loads((work / "candidates.json").read_text())
    fs = faces()
    glyphs = [("brace-left", "{"), ("question", "?"), ("brace-right", "}")]

    def from_cand(face, aspect=False):
        e = next(c for c in cands if c["face"] == face and c["aspect"] == aspect)
        return {k: (g["scale"], g["aspect"], g["tx"], g["ty"]) for k, g in e["glyphs"].items()}

    # Iterations 01-03: the face search (per-glyph fits), kept as evidence.
    iters = [("01_archivo700", "Archivo 700"), ("02_archivo800", "Archivo 800"), ("03_archivo900_perglyph", "Archivo 900")]
    for tag, face in iters:
        (work / f"{tag}.svg").write_text(svg(parts_for(fs[face], glyphs, from_cand(face)), tag))

    # Iteration 04: one shared scale + baseline (a single text run), x refit per glyph.
    font = fs["Archivo 900"]
    per = from_cand("Archivo 900")
    s = float(np.mean([v[0] for v in per.values()]))
    ty = float(np.mean([v[3] for v in per.values()]))
    targets, _, _ = load_targets(png)
    fits = {}
    metrics = {}
    for (key, ch), (x0, x1) in zip(glyphs, [(0, 30), (22, 69), (61, 91)]):
        polys, _ = contours(font, ch)
        tgt = region(targets["brace" if "brace" in key else "question"], x0, x1)
        best_tx, best = per[key][2], -1.0
        for tx in np.arange(per[key][2] - 1.0, per[key][2] + 1.0001, 0.02):
            v = soft_iou(raster(polys, s, 1.0, tx, ty, W, H), tgt)
            if v > best:
                best, best_tx = v, float(tx)
        fits[key] = (s, 1.0, best_tx, ty)
        metrics[key] = round(best, 4)
    final = parts_for(font, glyphs, fits)
    (work / "04_archivo900_shared.svg").write_text(svg(final, "04_archivo900_shared"))
    logo = svg(final, "wouldthiswin mark: {?} in Archivo 900")
    (outdir / "logo.svg").write_text(logo)
    (work / "final_fit.json").write_text(json.dumps({"face": "Archivo 900", "scale": s, "font_size_px": s * 1000, "baseline": ty, "tx": {k: v[2] for k, v in fits.items()}, "glyph_iou": metrics}, indent=1))
    print("shared scale", round(s, 5), "font-size", round(s * 1000, 2), "px baseline", round(ty, 2), "glyph IoU", metrics)


if __name__ == "__main__":
    main()
