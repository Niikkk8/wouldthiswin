// The face reel's script, one entry per line said to camera. The pipeline (scripts/reel.ts)
// matches each recorded take to these lines, and the ReelFace composition lays each line
// out as `layout` says. SHOOT.md is written from this file.

export type ReelLayout =
  | "face" // full-frame face
  | "face-cards" // face, with each question as a big text card as it's said
  | "product-circle" // the product full-frame, face in a lower-corner circle
  | "split-judges" // top: face, bottom: the judge being named
  | "odds-circle" // the answer landing and the odds rolling down, face in a circle
  | "face-endcard"; // face, then the end card

export type ReelLine = { id: number; text: string; layout: ReelLayout; note: string };

export const REEL_SCRIPT: ReelLine[] = [
  {
    id: 1,
    text: "the night before a hackathon submission, every team asks the same question.",
    layout: "face",
    note: "Face. The line is also big on-screen text from the very first frame.",
  },
  { id: 2, text: "would this win?", layout: "face", note: "Face. A beat of silence before it." },
  {
    id: 3,
    text: "i've won five hackathons. judges don't remember your tech stack. they remember one sentence, and whether the demo worked.",
    layout: "face",
    note: "Face.",
  },
  {
    id: 4,
    text: "and they ask the questions nobody practices. who's actually using this? what did you build this weekend? what breaks first?",
    layout: "face-cards",
    note: "Face, plus each question as a large text card the moment you say it.",
  },
  { id: 5, text: "so i built a panel you can practice on.", layout: "face", note: "Face." },
  {
    id: 6,
    text: "paste your repo. it reads your code, then three judges grill you. thirty seconds per question.",
    layout: "product-circle",
    note: "Product on screen, your face in a lower-corner circle. Look at the lens.",
  },
  {
    id: 7,
    text: "that's me. i'm the engineer. akshat's the investor. krish is... tired.",
    layout: "split-judges",
    note: "Split screen: you on top, the pixel portrait below. Cuts to the Investor, then the Tired Judge dozing on \"tired\". Leave the pause before \"tired\".",
  },
  {
    id: 8,
    text: "your odds move live with every answer. bluff, and you'll watch them drop.",
    layout: "odds-circle",
    note: "Product: an answer submitted, the odds rolling down. Face in a circle.",
  },
  {
    id: 9,
    text: "built it this week for twenty-five dollars. it's free. would yours win?",
    layout: "face-endcard",
    note: "Face, then the end card (wouldthiswin.com) on \"would yours win?\".",
  },
];

/**
 * The questions in line 4, as the cards show them, when the take has none of its own. The
 * cards normally use the questions as they were actually asked, in the order asked (every
 * sentence of line 4 that ends in "?"), so they always match the voice.
 */
export const REEL_QUESTIONS = ["who's actually using this?", "what did you build this weekend?", "what breaks first?"];

/**
 * Captions show what was actually said (lowercased, like the app), not the script: a
 * natural delivery paraphrases. These fix what the transcriber mishears, matched on whole
 * words (lowercase, punctuation ignored). Each is [heard, meant].
 */
export const CAPTION_FIXES: [string, string][] = [
  ["text tag", "tech stack"],
  ["akshad", "akshat"],
  ["akshay", "akshat"],
  ["akshit", "akshat"],
  ["chris", "krish"],
  ["krisch", "krish"],
];
