import { claim, type Fixture } from "./types";

/** A create-next-app starter barely touched. */
export const template: Fixture = {
  name: "template",
  readme: "This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).\n\n## Getting Started\n\nnpm run dev\n",
  files: {
    "package.json": '{ "scripts": { "dev": "next dev" }, "dependencies": { "next": "16" } }',
    "package-lock.json": "{}",
    "app/layout.tsx": 'export const metadata = {\n  title: "Create Next App",\n};',
    "app/page.tsx": "<p>Get started by editing app/page.tsx</p>",
    "public/next.svg": "<svg/>",
    "public/vercel.svg": "<svg/>",
    LICENSE: "MIT",
    "app/page.test.tsx": "test('x', () => {});",
    ".github/workflows/ci.yml": "on: push",
  },
  claims: [claim("A dashboard for study groups")],
  expected: ["template", "readme", "setup"],
};
