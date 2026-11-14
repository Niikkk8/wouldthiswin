import { claim, type Fixture } from "./types";

/** The README promises a custom model and real-time streaming; the code reads a JSON file and calls Math.random(). */
export const overclaim: Fixture = {
  name: "overclaim",
  readme: `# PulseBoard
Real-time AI crowd analytics with our custom ML model.

## Getting started
npm install
npm run dev
`,
  files: {
    "package.json": '{ "scripts": { "dev": "next dev" }, "dependencies": { "next": "16" } }',
    "package-lock.json": "{}",
    "lib/predict.ts": 'import data from "../data/crowd.json";\nexport const predict = () => Math.round(Math.random() * 100);',
    "data/crowd.json": "[]",
    LICENSE: "MIT",
    "lib/predict.test.ts": "test('x', () => {});",
    ".github/workflows/ci.yml": "on: push",
  },
  claims: [claim("Predicts density with our custom ML model", "ai"), claim("Streams crowd data in real time", "performance")],
  expected: ["ai", "readme"],
};
