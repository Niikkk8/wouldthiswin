# Face reel: the shoot

About 40 to 50 seconds on screen. The lines are in `reel/script.json`. Say each line two or
three times; `npm run reel` keeps the cleanest take.

## Before you hit record

- Phone vertical, 1080p or 4K, 30 fps. HDR off if you can (it still works, SDR looks truer).
- Face in the upper half of the frame, eyes about a third of the way down. Captions sit in the
  lower third, and the fix list and CTA put you in a small circle top right.
- A quiet room, the phone an arm's length away. No music in the background.

## How to say them

- Each line 2 or 3 times, with about 2 seconds of silence between takes. Silence is how the
  pipeline tells takes apart.
- Look at the lens. The pipeline can't check eye line, so it's on you (the takes report lists
  every take so you can overrule a pick).

## The clips

Name each file by its shot (any extension), drop them in `video/footage/raw/`:

| File | What |
|---|---|
| `01_hook` | "I built three AI judges that read your hackathon code. So I made a project that lies." |
| `01b_hook` | "Your README says AI-powered. Your code says Math.random()." |
| `01c_hook` | "Hackathon judges skim your README. Mine read your code." |
| `02_readme` | "It says real-time AI crowd analytics." |
| `03_reactions` | No dialogue: 4 or more reactions (wince, laugh, head in hands, a slow nod), a second or two each |
| `04_answer` | You answering the judge out loud ("Which one is true?"), 10 to 15 seconds |
| `05_verdict` | "Final verdict." |
| `06_fixlist` | "Then it hands you the fix list, so the real judges don't find this first." |
| `07_cta` | "It's free. Paste your repo. Link in bio." |
| `08_broll` | Optional: hands on keyboard, the laptop screen, the room |

The pipeline picks the strongest of the three hooks for the main cut and exports the other two
as alternate cuts.

## Then

```bash
cd video
npm run reel
```

Outputs in `video/out/`: `reel_9x16.mp4` (Instagram, X), `reel_4x5.mp4` (LinkedIn),
`reel_alt_hook_b.mp4`, `reel_alt_hook_c.mp4`, `reel_cover.png`, and `reel-takes.md` (which take
was picked for each line, and why). The first run downloads whisper.cpp and its model (about
500 MB) into `video/whisper.cpp`.
