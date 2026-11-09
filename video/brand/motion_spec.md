# wouldthiswin mark: motion spec (Pixel2Motion)

## Phase 1: source and brief

- **Source:** `public/logo.png`, 91x66 RGBA, transparent background.
- **Colours:** braces `#f5f5f4` (the site's text token), question mark `#ff3b30` (the site's loss red). No outline: the dark rim at 8x is just antialiasing over transparency.
- **Semantic parts (actors):** left brace, the question mark's hook, its square dot, right brace.
- **Personality:** *blunt, quick, a little cheeky.* It's a developer tool that judges you: geometric heavy type (engineered), one red accent (alarm). Closest preset: **Energetic / Bold**, toned toward Trustworthy for the braces (they land exactly, no squash). The question mark gets the personality: the one part allowed overshoot.
- **Usage:** end-card brand reveal inside the launch video (splash band, about 1.2 s), then a static hold.
- **Choreography sketch (staggered assembly + scale-pop):**
  1. Staging: empty frame, the judges already on screen.
  2. Anticipation: the braces start 18% apart and slightly compressed. They're a code block about to open.
  3. Action: the braces slide in to their tracking (root of the drag hierarchy), the hook pops up from the baseline with overshoot, the dot drops in last.
  4. Follow-through: the hook settles from 1.08 to 1; the dot lands with a small squash (dot only, volume-preserving), and the braces land without bounce.
  5. Final Frame Contract: lands exactly on `logo.svg`.

## Phase 2: geometry

**Hypothesis:** the mark is set in the site's display face, Archivo, at a heavy weight. A font glyph is the lowest-complexity *smooth* geometry there is: designed curves with no trace stairs.

| Iteration | Geometry | IoU (soft, own fitter) | IoU (skill overlay) | src-only / render-only px |
|---|---|---|---|---|
| 01 | Archivo 700, per-glyph fit | 0.767 | 0.779 | 582 / 44 |
| 02 | Archivo 800, per-glyph fit | 0.864 | 0.860 | 378 / 15 |
| 03 | Archivo 900, per-glyph fit | 0.976 | 0.991 | 14 / 11 |
| 04 | Archivo 900, **one shared scale + baseline**, x refit per glyph | 0.976 | **0.991** | 13 / 12 |
| (alt) | Archivo Black | 0.975 | | |
| (alt) | Archivo 900 with free x/y aspect | 0.976 | | |

Accepted at iteration 04, well inside the 10-iteration budget.

- The three per-glyph scales agree within 0.5% (0.0728 / 0.0726 / 0.0725), and the baselines within 0.06 px. It's one text run: `{?}` in **Archivo 900 at 72.65 px**, baseline at y = 54.12, with the logo's own tracking (glyph x = -1.89 / 23.37 / 64.79).
- A free aspect ratio adds nothing (0.9757 vs 0.9755), so natural proportions are the lower-complexity answer. Archivo Black fits almost as well, but Archivo 900 is the face the site already ships.
- **Residuals:** 13 + 12 px, all on antialiased edges of a 91x66 raster; no structural mismatch (centers, terminals, the brace points, the dot all line up in the overlays).
- **Smoothness gate: pass.** See the 8x render in `zoom_8x.png`. Path audit (`fit_work/audit_*.json`): every join-angle flag is a designed corner of the typeface (the braces' flat terminals at 90°, the square dot, the `?` stem's squared end at 84° and 98°). The one short-segment flag (0.65 px) is the brace's middle point as drawn in the font. None are trace artifacts.
- **Motion-ready structure:** `#brace-left`, `#question-hook`, `#question-dot`, `#brace-right`, each its own `<path>` in source pixel space (`viewBox 0 0 91 66`). No baked transforms.
- **QA note:** `render_overlay.py` measures a dark-on-white silhouette. The mark is light-on-transparent, so QA compares the source's alpha as a black-on-white silhouette (`fit_work/source_silhouette.png`) with the SVG in black fills (`*.qa.svg`).
- **Evidence:** `overlay_progress_strip.png`, `fit_iterations/`, `fit_work/` (fitters: `fit_glyphs.py`, `make_svg.py`; fonts are fetched to `.cache/logo/`).

## Phase 3: motion

To be written when the end card is animated (after style-frame approval). The choreography is built in Remotion (the only video framework for this project), driven by `useCurrentFrame()`, not CSS keyframes. QA follows the skill: frames at each pose, an easing check, and the Final Frame Contract (the last frame of the reveal, rendered by Remotion, against a static Remotion render of `logo.svg`, same pipeline, exact match).
