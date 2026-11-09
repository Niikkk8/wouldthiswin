"""Pixel2Motion Phase 2 for the wouldthiswin mark "{?}".

Hypothesis: the mark is set in the site's display face (Archivo, heavy). If a font glyph
explains the raster, its outline is the lowest-complexity *smooth* geometry available
(designed Bezier curves, no trace stairs), so it passes the smoothness gate by construction.

For each candidate face, each glyph gets its own uniform scale + offset (and optionally an
x/y aspect), found by a pattern search maximising soft IoU against the source alpha of that
glyph's colour. Writes candidates.json with per-candidate metrics and SVG path data in the
source's pixel space (viewBox 0 0 91 66).

Usage: python fit_glyphs.py <logo.png> <out_dir>
"""

import json
import sys
from pathlib import Path

import numpy as np
from fontTools.pens.recordingPen import RecordingPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent.parent
SS = 8  # supersampling for the rasteriser


def load_targets(png: Path):
    im = np.array(Image.open(png).convert("RGBA")).astype(float) / 255
    a = im[..., 3]
    r, g = im[..., 0], im[..., 1]
    # Colour membership, softened by alpha: braces are near-white, the ? is red.
    white = a * np.clip((g - 0.45) / 0.4, 0, 1)
    red = a * np.clip((r - g - 0.3) / 0.4, 0, 1)
    return {"brace": white, "question": red}, im.shape[1], im.shape[0]


def faces():
    out = {}
    var = TTFont(HERE / "archivo-var.woff2")
    for w in (700, 800, 900):
        f = instantiateVariableFont(TTFont(HERE / "archivo-var.woff2"), {"wght": w})
        out[f"Archivo {w}"] = f
    out["Archivo Black"] = TTFont(HERE / "archivo-black.woff2")
    del var
    return out


def contours(font: TTFont, ch: str):
    """The glyph's contours as lists of flattened (x, y) points in font units, y up."""
    gs = font.getGlyphSet()
    name = font.getBestCmap()[ord(ch)]
    pen = RecordingPen()
    gs[name].draw(pen)
    polys, cur, last = [], [], None
    for op, pts in pen.value:
        if op == "moveTo":
            cur = [pts[0]]
            last = pts[0]
        elif op == "lineTo":
            cur.append(pts[0])
            last = pts[0]
        elif op in ("qCurveTo", "curveTo"):
            # Flatten: quadratic splines (TrueType) or cubics, 16 steps per segment.
            ctrl = [last, *pts]
            if op == "qCurveTo":
                # Expand implied on-curve points.
                on = [ctrl[0]]
                offs = ctrl[1:-1]
                segs = []
                for i, c in enumerate(offs):
                    end = ctrl[-1] if i == len(offs) - 1 else ((c[0] + offs[i + 1][0]) / 2, (c[1] + offs[i + 1][1]) / 2)
                    segs.append((on[-1], c, end))
                    on.append(end)
                for p0, c, p1 in segs:
                    for t in np.linspace(0, 1, 17)[1:]:
                        cur.append(((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * c[0] + t * t * p1[0], (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * c[1] + t * t * p1[1]))
            else:
                p0, c1, c2, p1 = ctrl
                for t in np.linspace(0, 1, 17)[1:]:
                    mt = 1 - t
                    cur.append((mt**3 * p0[0] + 3 * mt * mt * t * c1[0] + 3 * mt * t * t * c2[0] + t**3 * p1[0], mt**3 * p0[1] + 3 * mt * mt * t * c1[1] + 3 * mt * t * t * c2[1] + t**3 * p1[1]))
            last = pts[-1]
        elif op in ("closePath", "endPath"):
            if cur:
                polys.append(cur)
            cur = []
    return polys, name


def raster(polys, s, sx, tx, ty, W, H):
    """Alpha of the glyph placed with x' = x*s*sx + tx, y' = -y*s + ty, in source pixels."""
    img = Image.new("L", (W * SS, H * SS), 0)
    d = ImageDraw.Draw(img)
    # Even-odd isn't needed for these glyphs (no counters), but draw holes by winding anyway:
    for p in polys:
        pts = [((x * s * sx + tx) * SS, (-y * s + ty) * SS) for x, y in p]
        d.polygon(pts, fill=255)
    return np.array(img.resize((W, H), Image.BOX)).astype(float) / 255


def soft_iou(a, b):
    return float(np.minimum(a, b).sum() / max(1e-9, np.maximum(a, b).sum()))


def region(target, x0, x1):
    m = np.zeros_like(target)
    m[:, x0:x1] = target[:, x0:x1]
    return m


def bbox(m, thr=0.5):
    ys, xs = np.nonzero(m > thr)
    return xs.min(), xs.max() + 1, ys.min(), ys.max() + 1


def fit(polys, target, W, H, aspect: bool):
    # Initial guess from bounding boxes.
    allp = np.array([pt for p in polys for pt in p])
    gx0, gx1, gy0, gy1 = allp[:, 0].min(), allp[:, 0].max(), allp[:, 1].min(), allp[:, 1].max()
    x0, x1, y0, y1 = bbox(target)
    s = (y1 - y0) / (gy1 - gy0)
    sx = ((x1 - x0) / (gx1 - gx0)) / s if aspect else 1.0
    tx = x0 - gx0 * s * sx
    ty = y0 + gy1 * s
    p = np.array([s, sx, tx, ty])
    steps = np.array([s * 0.02, 0.02 if aspect else 0.0, 0.5, 0.5])
    best = soft_iou(raster(polys, *p, W, H), target)
    for _ in range(60):
        improved = False
        for i in range(4):
            if steps[i] == 0:
                continue
            for sgn in (1, -1):
                q = p.copy()
                q[i] += sgn * steps[i]
                v = soft_iou(raster(polys, *q, W, H), target)
                if v > best + 1e-6:
                    best, p, improved = v, q, True
        if not improved:
            steps = steps * 0.5
            if steps[2] < 0.01:
                break
    return p, best


def svg_path(font, name, s, sx, tx, ty):
    gs = font.getGlyphSet()
    pen = SVGPathPen(gs, ntos=lambda v: f"{v:.3f}".rstrip("0").rstrip("."))
    gs[name].draw(TransformPen(pen, (s * sx, 0, 0, -s, tx, ty)))
    return pen.getCommands()


def split_contours(d: str):
    """One sub-path per contour (M ... Z), so the ? hook and dot can be separate actors."""
    parts = [("M" + p).strip() for p in d.split("M") if p.strip()]
    return parts


def main():
    png, out = Path(sys.argv[1]), Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    targets, W, H = load_targets(png)
    results = []
    for face_name, font in faces().items():
        for aspect in (False, True):
            entry = {"face": face_name, "aspect": aspect, "glyphs": {}}
            total_inter = total_union = 0.0
            union_r = np.zeros((H, W))
            for key, ch, x0, x1 in (("brace-left", "{", 0, 30), ("question", "?", 22, 69), ("brace-right", "}", 61, 91)):
                tgt = region(targets["brace" if "brace" in key else "question"], x0, x1)
                polys, name = contours(font, ch)
                p, iou = fit(polys, tgt, W, H, aspect)
                r = raster(polys, *p, W, H)
                union_r = np.maximum(union_r, r)
                total_inter += np.minimum(r, tgt).sum()
                total_union += np.maximum(r, tgt).sum()
                d = svg_path(font, name, *p)
                entry["glyphs"][key] = {"iou": round(iou, 4), "scale": float(p[0]), "aspect": float(p[1]), "tx": float(p[2]), "ty": float(p[3]), "d": d, "contours": len(split_contours(d))}
            entry["iou"] = round(total_inter / total_union, 4)
            results.append(entry)
            print(f"{face_name:14s} aspect={'free' if aspect else '1.0 '}  IoU {entry['iou']:.4f}  " + "  ".join(f"{k} {v['iou']:.3f}" for k, v in entry["glyphs"].items()), flush=True)
    results.sort(key=lambda e: -e["iou"])
    (out / "candidates.json").write_text(json.dumps(results, indent=1))


if __name__ == "__main__":
    main()
