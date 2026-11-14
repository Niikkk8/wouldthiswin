#!/usr/bin/env bash
# Renders every v3 deliverable from src/v3/edits.json, its sound stem, and a mixed copy.
# Silent masters and stems go to out/; the mixed copies to out/mixed/. Needs the captures
# (npm run capture:v3) in public/capture/v3.
set -euo pipefail
cd "$(dirname "$0")/.."
FF=${FFMPEG:-node_modules/ffmpeg-static/ffmpeg.exe}
[ -x "$FF" ] || FF=node_modules/ffmpeg-static/ffmpeg
mkdir -p out/mixed out/v3/sfx
python -m sfx.cues.v3
# 2560x1800 captures are heavy to decode: keep concurrency and the frame cache modest.
render() { npx remotion render src/index.ts "$1" "out/$2.mp4" --timeout=120000 --concurrency=3 --offthreadvideo-cache-size-in-bytes=1500000000 --log=error; }
# ONLY="hero,readme" renders a subset (matched against the output names).
want() { [ -z "${ONLY:-}" ] && return 0; for o in ${ONLY//,/ }; do [[ "$1" == *"$o"* ]] && return 0; done; return 1; }
for pair in "v3-hero-16x9:wouldthiswin-hero-16x9" "v3-teaser-9x16:wouldthiswin-teaser-9x16" \
  "v3-feature-voice:feature-voice-answers" "v3-feature-key:feature-leaked-key-caught" \
  "v3-feature-title:feature-create-next-app-caught" "v3-feature-fixes:feature-fix-list" \
  "v3-feature-rejudge:feature-rejudge-delta" "v3-readme-loop:readme-loop-source"; do
  id=${pair%%:*}; name=${pair##*:}
  want "$name" || continue
  render "$id" "$name"
  cp "out/v3/sfx/$id.wav" "out/$name-sfx.wav"
  "$FF" -v error -y -i "out/$name.mp4" -i "out/$name-sfx.wav" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -shortest -movflags +faststart "out/mixed/$name.mp4"
done
# The README GIF: 640 wide, one palette for the whole loop.
"$FF" -v error -y -i out/readme-loop-source.mp4 -vf "fps=20,scale=640:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle" out/wouldthiswin-readme-loop.gif
# The odds ticker: rendered on the page's black, then un-composited to alpha (the widget's
# white and red over #0a0a0b), ProRes 4444.
npx remotion render src/index.ts v3-odds-ticker out/v3/ticker-src.mov --codec=prores --prores-profile=4444 --timeout=120000 --concurrency=3 --log=error
"$FF" -v error -y -i out/v3/ticker-src.mov -vf "format=rgb24,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)',format=gbrp,lutrgb=r='clip((val-10)*255/245,0,255)':g='clip((val-10)*255/245,0,255)':b='clip((val-11)*255/244,0,255)',format=rgba,geq=r='if(gt(max(max(r(X,Y),g(X,Y)),b(X,Y)),0),r(X,Y)*255/max(max(r(X,Y),g(X,Y)),b(X,Y)),0)':g='if(gt(max(max(r(X,Y),g(X,Y)),b(X,Y)),0),g(X,Y)*255/max(max(r(X,Y),g(X,Y)),b(X,Y)),0)':b='if(gt(max(max(r(X,Y),g(X,Y)),b(X,Y)),0),b(X,Y)*255/max(max(r(X,Y),g(X,Y)),b(X,Y)),0)':a='max(max(r(X,Y),g(X,Y)),b(X,Y))'" -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le out/odds-ticker-alpha.mov
cp out/v3/sfx/v3-odds-ticker.wav out/odds-ticker-sfx.wav
echo done
