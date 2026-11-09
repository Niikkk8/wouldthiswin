# Face reel: the shoot

About 40 seconds on screen, 9 lines. You say each line **three times**, the pipeline keeps the cleanest take.

## Before you hit record

- **Phone vertical**, rear camera if someone can frame you, otherwise front. 1080p or 4K, **30 fps**.
- **HDR off** if you can (iPhone: Settings > Camera > Formats > Video Capture > HDR Video off). HDR footage still works, the pipeline tone-maps it, but SDR gives truer skin.
- Face in the **upper half** of the frame: eyes about a third of the way down. Lines 6 and 8 put you in a small circle, line 7 shows only the top half of the frame.
- A quiet room, a mic or the phone close (an arm's length). No music in the background: the reel is voice only.
- Lowercase delivery is fine: these are spoken, not read.

## How to say them

- Each line **3 times**, with **2 seconds of silence** between takes and **3 seconds** before the next line. Silence is how the pipeline tells takes apart.
- Fluffed it? Stop, pause 2 seconds, start the line again from the top. Don't patch from the middle: half-takes are thrown away.
- Say the words as written. Small slips are fine ("you'll" for "you will"), but whole swapped words cost a take points.
- One long recording or many short ones: both work. Any order of lines works too.
- Line 7: **leave the pause** in "krish is... tired". The cut keeps it.

## The script

| # | On screen | Say it |
|---|---|---|
| 1 | Face. The line is also big text from the first frame | the night before a hackathon submission, every team asks the same question. |
| 2 | Face | would this win? |
| 3 | Face | i've won five hackathons. judges don't remember your tech stack. they remember one sentence, and whether the demo worked. |
| 4 | Face + each question as a big card as you say it | and they ask the questions nobody practices. who's actually using this? what did you build this weekend? what breaks first? |
| 5 | Face | so i built a panel you can practice on. |
| 6 | Product, your face in a lower-corner circle | paste your repo. it reads your code, then three judges grill you. thirty seconds per question. |
| 7 | Split: you on top, the pixel portrait below (Engineer, then Investor, then the Tired Judge dozing on "tired") | that's me. i'm the engineer. akshat's the investor. krish is... tired. |
| 8 | Product: an answer lands, the odds roll down; face in a circle | your odds move live with every answer. bluff, and you'll watch them drop. |
| 9 | Face, then the end card on "would yours win?" | built it this week for twenty-five dollars. it's free. would yours win? |

The words, the layouts and the cues all come from `src/reel-script.ts`. Edit a line there and the pipeline follows.

## After the shoot

1. Copy the clips into `video/footage/` (mp4 / mov, any names).
2. From `video/`: `npm run reel`
   - transcribes locally (faster-whisper small.en, CPU, about 1 minute per 5 minutes of footage),
   - prints which take it picked for each line and why,
   - renders `out/reel-face-9x16.mp4`, `out/reel-face-9x16-ig.mp4` (voice only) and `out/reel-face-9x16-linkedin.mp4` (voice + music, once `audio/music.mp3` exists).
3. Don't like a pick? Look at the report (`.cache/reel/report.txt`), then either re-record that line into `footage/` (a new take wins only if it's cleaner) or delete the bad clip.
4. `npm run check` for the delivery check.

Needs once: `py -3.12 -m venv .venv` and `.venv/Scripts/python -m pip install faster-whisper` (already done on this machine).

## The launch video's voiceover (for reference)

The launch video (`out/v2/launch-*-vo.mp4`) doesn't need a shoot: its voice is generated locally with Chatterbox (`scripts/voice_cb.py`, MIT), directed line by line, with the best of several takes kept by `scripts/voice_pick.py`. The script, captions and direction all live in `scripts/script_v3.py`. To change a line, edit it there, then run `voice_cb.py lines <id>`, `voice_pick.py`, `voice_words.py` and `npm run render:v2`.

| # | Lands on | Line | The read |
|---|---|---|---|
| 1 | Frame 0, the hook | hackathon project due tonight? | a friend leaning in |
| 2 | The slam | would this win? | the question everyone's actually asking |
| 3 | The repo typing in | paste your repo. | easy, one step |
| 4 | The scan | it checks your readme against your actual code. | a little conspiratorial on "actual code" |
| 5 | The red finding, then the drop | promised something you didn't build? your odds drop. | eyebrow raised; "your odds drop" starts exactly on the drop |
| 6 | The panel sliding in | then three judges grill you. | relish "grill" |
| 6a | The Engineer's punch-in | the engineer wants proof. | dry |
| 6b | The Investor's punch-in | the investor wants to know who's paying. | a smirk |
| 6c | The Tired Judge dozing | and the tired judge has seen forty demos today. one sentence. go. | the joke: he jolts awake exactly on "go" |
| 7 | The deliberation thread | then they talk about you. right in front of you. | mock-scandalised |
| 8 | The review card | and tell you exactly what to fix. | warm, landing |
| 9 | The end card | would yours win? try it free at wouldthiswin dot com. | a challenge, then an invitation |

Each judge's name tag ("the engineer", "the investor", "the tired judge") appears on their card as the voice names them.
