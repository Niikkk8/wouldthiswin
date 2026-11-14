import { claim, type Fixture } from "./types";

/** An honest, tidy repo: every check should stay quiet. */
export const honest: Fixture = {
  name: "honest",
  readme: `# Queueless
Lets a small clinic's patients join the waiting line from a QR code.

![Screenshot](docs/screen.png)

Live demo: https://queueless.vercel.app

## How it works
Patients scan, get a ticket, and see their place update.

## Tech stack
Next.js, Postgres.

## Team
Asha (backend), Ben (frontend).

## Getting started
npm install
npm run dev
`,
  files: {
    "package.json": '{ "name": "queueless", "scripts": { "dev": "next dev", "test": "vitest" }, "dependencies": { "next": "16" } }',
    "package-lock.json": "{}",
    ".env.example": "DATABASE_URL=\n",
    "app/layout.tsx": 'export const metadata = { title: "Queueless" };',
    "lib/queue.ts": "export const join = (db, id) => db.ticket.create({ data: { id, url: process.env.DATABASE_URL } });",
    "lib/queue.test.ts": "test('joins', () => {});",
    ".github/workflows/ci.yml": "on: push",
    LICENSE: "MIT",
  },
  claims: [claim("Join the line from a QR code")],
  expected: [],
};
