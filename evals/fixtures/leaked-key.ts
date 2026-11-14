import { claim, type Fixture } from "./types";

// Assembled at runtime from fragments so no key-shaped string is committed.
const key = ["sk", "_live_", "Q7xkP2mZ9vRt4LwYb8NcD3fHs6JgA1uE"].join("");

/** A Stripe live key in the code and a committed .env file. */
export const leakedKey: Fixture = {
  name: "leaked-key",
  readme: `# Payme
Lets students split rent in one tap.

![Demo](demo.gif)

https://payme.vercel.app

## How it works
Charges each roommate.

## Stack
Express.

## Team
Ro.

## Setup
npm install
npm start
`,
  files: {
    "package.json": '{ "scripts": { "start": "node server.js" } }',
    "package-lock.json": "{}",
    "server.js": `const stripe = require("stripe")("${key}");`,
    ".env": `STRIPE_KEY=${key}`,
    LICENSE: "MIT",
    "test/server.test.js": "test('x', () => {});",
    ".github/workflows/ci.yml": "on: push",
  },
  claims: [claim("Splits rent between roommates")],
  expected: ["secrets"],
};
