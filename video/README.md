# video

The product videos and the face reel, made from the real app. Everything here is source;
captures, renders, footage, whisper.cpp and environments stay local (see the root .gitignore).

## v3 (current)

| Step | Command | What |
|---|---|---|
| 1 | `npx next dev -p 3124` in the repo root | the app; the dev-only `/capture/[act]` routes 404 in production |
| 2 | `npm run capture:v3` | records every take at 2x (desktop 1280x900 at 2x, phone 540x960 at 3x), frame by frame on a fake clock, with each key element's rect per frame, into `public/capture/v3` |
| 3 | `bash scripts/render-v3.sh` | renders every deliverable in `src/v3/edits.json`, its sound stem (`sfx/cues/v3.py`) and a mixed copy into `out/` (`ONLY=hero,teaser` for a subset) |
| 4 | `npm run reel` | the face reel from `footage/raw` (see `SHOOT.md`) |

- `src/v3/edits.json`: every video as a shot list. A shot is a capture, a source time, and a
  camera that lands on a named element (or a rect) and fills a share of the frame; plus one
  kinetic caption. `node scripts/v3-summary.mjs 16x9` prints where each element is, when.
- `src/v3/footage.tsx`: the camera (push-ins, moves between targets, a spotlight that dims the
  rest of the page, a shake on a drop).
- `src/v3/edit.tsx`: captions, light, the end card, the edit.
- `src/reel/Reel.tsx` and `scripts/reel-v3.ts`: the face reel. `npm run reel:placeholders`
  writes test footage (Windows text to speech) to try the pipeline before the shoot.

## Older

`src/v2`, `src/Launch.tsx`, `src/ReelFace.tsx` and their scripts are the previous launch cut
and face reel (`npm run render:v2`, `npm run reel:v2`), kept as reference.
