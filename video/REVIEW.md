# Overnight review

**Update (round 2):** the review caption no longer covers the fixes; effects are 6 dB lower; the Instagram launch cut is mastered to -20 LUFS; the judge palette fix is committed on its own (branch `fix/judge-palette-png`); the 924 MB of captures is deleted (`npm run render` records them again when needed). Details in each section below.

Nothing pushed. The only commit is the judge palette fix. Everything lives in `video/` (its own npm project), plus five small exclusion edits at the repo root (listed at the end).

## Files

### Part A: the product video (`video/out/`)

| File | Length | Size | What |
|---|---|---|---|
| `launch-16x9.mp4` | 45.33 s | 3.75 MB | 1920x1080, H.264 High, 30 fps, AAC 48k stereo. SFX + music slot (empty, see Music). X, Peerlist, Reddit |
| `launch-9x16.mp4` | 45.31 s | 4.75 MB | 1080x1920, same specs. SFX + music slot (empty). LinkedIn. -14 LUFS |
| `launch-9x16-ig.mp4` | 45.31 s | 4.75 MB | 1080x1920, SFX only, mastered quieter (-20 LUFS) so the effects stay under the song you add in Instagram |
| `cover-9x16.png` | | 238 KB | 1080x1920: the odds-drop frame (37%, red "-19 SMS claim unbacked" chip, caption up) |
| `captions.srt` | | 0.5 KB | The 10 on-screen captions, timed to the 9:16 cut (scene 8 reads "and tell you what to fix", from 38.2 s) |
| `contact-sheet.png` | | 396 KB | One frame per scene, 9:16 row on top, 16:9 row below |

![contact sheet](out/contact-sheet.png)

### Part B: the face reel pipeline test (`video/out/placeholder-test/`)

Made from placeholder footage (Windows text-to-speech over a test pattern), only to prove the pipeline works end to end. The real files come from `npm run reel` after the shoot.

| File | Length | Size |
|---|---|---|
| `reel-face-9x16-placeholder.mp4` | 44.54 s | 33.1 MB |
| `reel-face-9x16-ig-placeholder.mp4` (voice only) | 44.54 s | 33.1 MB |
| `reel-face-9x16-linkedin-placeholder.mp4` (voice + music: no music yet, so voice only) | 44.54 s | 33.1 MB |
| `contact-sheet-reel-placeholder.png` | | 344 KB |

![reel contact sheet](out/placeholder-test/contact-sheet-reel-placeholder.png)

## Delivery check (`npm run check`): all passed

All six mp4s: H.264 High, yuv420p, exactly 30/1 fps, faststart (moov first), AAC-LC 48 kHz stereo.

| File | Loudness | True peak | Platform limits |
|---|---|---|---|
| launch-16x9 | -14.17 LUFS | -1.92 dBTP | X: under 512 MB, under 140 s, 1920 px or less, 60 fps or less |
| launch-9x16 | -14.16 LUFS | -2.02 dBTP | Instagram Reels, X, LinkedIn |
| launch-9x16-ig | **-20.01 LUFS** (target -20) | -2.83 dBTP | Instagram Reels (3 s to 3 min), under 90 s |
| reel (placeholder) | -14.06 LUFS | -1.79 dBTP | Instagram, X, LinkedIn |

The launch files are small (0.6 to 0.8 Mbps) because the UI is mostly still. It's CRF 12, so quality is high and Instagram/X will re-encode anyway.

## The launch cut, as built

| Time | Scene | Source | Caption | Sound |
|---|---|---|---|---|
| 0-3 s | Hook text, judges blinking | Remotion, real sprite sheets at exactly 2x | (the hook itself, on frame 1) | |
| 3-5 s | "would this win?" | Remotion | | |
| 5-8 s | `github.com/latenight/queue-less` typed, Face the panel pressed (shows "Finding a panel") | real landing page | | key clicks, tap on press |
| 8-15 s | The scan, 50%, claims traced, -19 with the shake, settles at 31% | real `/demo` | it reads your actual code | whoosh per beam, thud on the -19 and -9 drops |
| 15-25 s | The Engineer large, question types out, answer types, the others react | real `/demo` | three judges. 30 seconds a question. | key clicks on the answer |
| 25-30 s | The Tired Judge asks, then nods off | real `/demo` (see note) | one of them is very tired | |
| 30-36 s | Deliberation: messages arriving, the odds replay chart | real `/demo` | they talk about you. in front of you. | soft click per message |
| 36-41 s | Review: Changes requested, 34%, then scrolls to "Fix before demos" | real `/demo` | 9:16: "and tell you what to fix", high (y 470), from the scroll on. 16:9: "and tell you what to fix before you submit" | tap as the verdict lands |
| 41-45 s | End card, judges blinking, wouldthiswin.com, free. no sign-up. | Remotion | | chime |

## How it's made (and where I deviated)

- **Components vs recording.** The act components run on real timers, Motion and Web Animations, which Remotion can't drive frame-accurately. So I recorded `/demo` with Playwright. It isn't screen-recorded, though: `scripts/capture.ts` runs every timer on Playwright's fake clock and pauses and steps every CSS/Web Animation by hand. Each PNG is the app exactly 1/30 s after the previous one, with no dropped or smeared frames. Remotion composes those frames with the captions, cards and sound. The hook and end card are Remotion-native but use the real sprite sheets and `lib/judge-sprites.ts` frame table.
- **Pixel art.** 9:16 is the phone layout (540x960 at 2x), so a 128 px judge is exactly 256 output px. 16:9 is the desktop layout at 1x (128/256 px). Remotion never scales a capture. Cards use whole-number scales and `image-rendering: pixelated`.
- **Repo name.** The fixture says `queueless-team/queueless`. The storyboard types `github.com/latenight/queue-less`. The capture swaps the string in the served JS (video only, the product is untouched), so the header and review read `latenight/queue-less` / `queue-less`.
- **The doze shot.** In `/demo` the sample team starts typing 0.7 s after each question, so the Tired Judge never dozes (it takes 10 s idle). For that one take the capture delays the team's typing on question 3 to 14 s. That's the real behavior a user sees if they stall. Video only, no product change.
- **The review** was on screen 0.8 s in the normal demo flow. The capture holds on it, then scrolls to the fixes.
- **Captions** are lowercase Archivo 800 on a solid dark chip. On 9:16 they sit at y 1385 to about 1540, and the capture is moved up 136 px so the odds and answer clear Instagram's top and bottom overlays. On the 9:16 review scene the caption is shortened to "and tell you what to fix", moved up over the review comments, and held back until the page scrolls (about 1.9 s in), so the verdict and 34% show clean first and all three fixes are fully readable at the end. 16:9 keeps the full line: its fixes sit above the caption.
- **The hook text is on frame 1** (thumbnail-safe), as asked.

## Sound

- All SFX are synthesized in code (`scripts/sfx.ts`, seeded, no files downloaded): 4 key-click variants, whoosh (band-passed noise sweep), thud (110 to 42 Hz sine drop + muffled knock), tap, chime (C6/G6 dyad). Cue times come from what's on screen in each capture frame (text length growing, scan beams drawn, the odds chip changing), not hand-placed.
- **Levels (round 2):** every effect is 6 dB below the first version (`SFX_GAIN = 0.5` in `src/Launch.tsx`), so they sit clearly under the music bed (0.22) once it exists.
- **Mastering:** gain, a true-peak-aware limiter (4x oversampled), corrected in a loop until within 0.3 LU of the target. The music versions go to -14 LUFS, and `launch-9x16-ig.mp4` to -20 LUFS (so the effects never compete with the song you add in Instagram).
- **Until music exists, the -6 dB doesn't change `launch-16x9` / `launch-9x16`:** they're effects only, and mastering to -14 brings them back to the same loudness. The -6 dB shows up as soon as there's music to sit under. The IG cut is quieter regardless (-20).
- **Music: `video/audio/music.mp3` still doesn't exist (checked again in round 2)**, so the music slot is empty and nothing was re-rendered for it. Drop the file in and run `npm run render` (and `npm run reel`). Then `launch-16x9` and `launch-9x16` get the bed at 0.22 with a 20-frame fade-in and 1.5 s fade-out, ducked to 0.09 around the thud, taps and chime. The reel's LinkedIn cut gets it at 0.09 under the voice. The IG versions never get music.
- I didn't listen to the result (no speakers here). Levels are measured, not auditioned: give it one listen.

## Part B: face reel pipeline

`npm run reel` (from `video/`), with clips in `video/footage/`:

1. Pulls 16 kHz mono audio out of every clip.
2. Transcribes locally with faster-whisper `small.en` (CPU, int8, word timestamps). The prompt makes Whisper keep "um"/"uh" so they count against a take.
3. Aligns the transcript to `src/reel-script.ts` word by word, with fuzzy matching (it handles "30"/"thirty", "$25"/"twenty-five dollars", and misheard names: TTS "akshat"/"krish" came back "Uxut's"/"Chris" and still matched at 82%). It finds every take of every line.
4. Picks the cleanest per line (script match, fillers, long stalls, word confidence; ties go to the later take). Half-takes ("...sorry, again.") are discarded. A leading "um" is trimmed off by the cut.
5. Cuts each pick tight: 0.14 s before the first word, 0.24 s after the last. Pauses inside a line are capped at 0.55 s, except line 7's "krish is... tired", which is kept up to 0.95 s.
6. Frames 1080x1920 cover at 30 fps, applies a light grade (contrast 1.04, saturation 1.07, gamma 1.02, a touch of unsharp). HDR phone footage (HLG/PQ) is detected and tone-mapped to SDR.
7. Voice chain: high-pass 75 Hz, light FFT denoise, gentle compression, levelled. The final master is -14 LUFS.
8. Remotion lays out the 9 lines (see the contact sheet above): line 1 as big text from frame 1 with the spoken word highlighted, word-by-word captions throughout with the current word inverted, question cards on line 4, product + face circle on 6 and 8, split screen with crisp 4x portraits switching on "akshat's", "krish" and dozing on "tired" on line 7, and the end card on "would yours win?", held 1.5 s after the last word.

Placeholder test result (`.cache/reel/report-placeholder.txt`): all 9 lines found, the clean take picked each time, 44.5 s total. It's a little long because the TTS voice is slow; your real delivery will likely land around 40 s.

Tomorrow: `SHOOT.md` has the script, framing and how to say the takes. After the shoot, drop the clips in `footage/`, run `npm run reel`, read the printed take report, then `npm run check`.

## Repo changes outside `video/`

- `tsconfig.json`: `"exclude": ["node_modules", "video"]` (Next's type check skips it)
- `eslint.config.mjs`: ignores `video/**`
- `app/globals.css`: `@source not "../video";` (Tailwind doesn't scan the video project)
- `.vercelignore` (new): `video/`
- `.gitignore`: `video/out/`, `video/node_modules/`, `video/.venv/`, `video/footage/`, `video/.cache/`, generated `video/public/*` assets, logs

Verified: `next build` succeeds and `npm run lint` is clean with `video/` present.

## Heads-up

- **Judge sprites (fixed, round 2):** `npm run judges` repacked the engineer's frames and sheet as palette PNGs (the new art had more than 256 colours: 0.8% of channel values moved by quantizing, no visible change in the previews). All 173 tests pass. It's committed on its own as `8cbb934` on branch `fix/judge-palette-png` (branched from `main`, not pushed). The video work stays uncommitted.
- **Captures deleted (round 2):** `video/public/capture/` (924 MB) is gone. **`npm run render` recreates it**: if any take is missing it starts the site (`next dev` on :3123), records the missing takes (about 15 minutes for all six), then stops the site. `npm run reel` does the same, since lines 6 and 8 show the product. Tested by deleting one take: it was re-recorded and the server was stopped afterwards. The finished files in `out/` don't need the captures.
- **Remotion license:** free for individuals and companies of 3 or fewer people. Over that, it needs a company license.
- The ffmpeg-skill MCP wasn't installed (optional, not needed). ffmpeg/ffprobe come from the `ffmpeg-static` / `ffprobe-static` npm packages, and Python lives in `video/.venv`.

## Rebuild everything

```bash
cd video
npm install
npm run render         # records any missing captures first (~15 min, starts the site itself),
                       # then plans cuts, renders, masters, cover, captions (~5 min)
npm run check
npm run sheet
npm run studio         # Remotion Studio to tweak timing by eye
```
