import assert from "node:assert/strict";
import { describe, test } from "vitest";
import { collectSnapshot, envPathsToTrace, pickCheckFiles } from "./collect";
import { hygiene } from "./hygiene";
import { runChecks } from "./index";
import { readmeChecklist, readmeEssentials } from "./readme";
import { entropy, jwtRole, redact, secretsInHistory, secretsInTree } from "./secrets";
import { envReads, setupReproducibility } from "./setup";
import { templateLeftovers } from "./template";
import { snapshot } from "./types";

// Secret-shaped strings are assembled at runtime, so nothing in this file looks like a key to
// a scanner (GitHub push protection) while the checks still see the real shape.
const join = (...parts: string[]) => parts.join("");
const RANDOM = "Q7xkP2mZ9vRt4LwYb8NcD3fHs6JgA1uE";
const KEYS = {
  openai: join("sk", "-proj-", RANDOM, "Xy0"),
  anthropic: join("sk", "-ant-", "api03-", RANDOM, RANDOM),
  groq: join("gs", "k_", RANDOM, RANDOM.slice(0, 20)),
  google: join("AI", "za", "Sy", RANDOM, "b"),
  aws: join("AK", "IA", "J5T2QX7RW9LMNB4K"),
  stripe: join("sk", "_live_", RANDOM),
  github: join("gh", "p_", RANDOM, "abcd"),
};
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = (role: string) =>
  join(
    "eyJ",
    b64({ alg: "HS256" }).slice(3),
    ".",
    b64({ iss: "supabase", role }),
    ".",
    "s1gnatureS1gnatureS1gnature",
  );
const pem = join("-----BEGIN ", "RSA ", "PRIVATE KEY-----");

describe("check 1: secrets in the tree", () => {
  test("every provider's key shape is caught, with a redacted prefix and path:line", () => {
    const text = Object.values(KEYS)
      .map((k, i) => `KEY_${i}=${k}`)
      .join("\n");
    const found = secretsInTree(snapshot({ files: new Map([["src/config.ts", text]]) }));
    assert.equal(found.length, Object.keys(KEYS).length);
    for (const f of found) {
      assert.equal(f.visibility, "private");
      assert.equal(f.severity, "blocker");
      assert.ok(
        !Object.values(KEYS).some((k) => f.detail.includes(k)),
        "the key itself is never kept",
      );
    }
    assert.match(found[0].detail, /at src\/config\.ts:1/);
  });

  test("a Supabase JWT counts only with the service_role claim; private keys always", () => {
    const files = new Map([
      [
        "lib/db.ts",
        `const anon = "${jwt("anon")}";\nconst admin = "${jwt("service_role")}";\n${pem}`,
      ],
    ]);
    const found = secretsInTree(snapshot({ files }));
    assert.deepEqual(
      found.map((f) => f.title),
      ["Supabase service-role key in the repo", "Private key in the repo"],
    );
    assert.equal(jwtRole(jwt("service_role")), "service_role");
  });

  test("placeholders aren't keys", () => {
    const files = new Map([
      [
        ".env.example",
        join(
          "OPENAI_API_KEY=sk",
          "-your-openai-api-key-goes-here-xxxxxx\nAWS=AK",
          "IAXXXXXXXXXXXXXXXX",
        ),
      ],
    ]);
    assert.deepEqual(secretsInTree(snapshot({ files })), []);
    assert.ok(entropy("xxxxxxxxxxxxxxxx") < 1);
  });

  test("a committed .env is a finding even unread; templates aren't", () => {
    const found = secretsInTree(
      snapshot({ tree: [".env", ".env.local", ".env.example", "server/.env.production"] }),
    );
    assert.deepEqual(
      found.map((f) => f.evidence[0]),
      [
        { kind: "file", path: ".env" },
        { kind: "file", path: ".env.local" },
        { kind: "file", path: "server/.env.production" },
      ],
    );
  });

  test("redaction keeps a few characters at most", () => {
    assert.equal(redact(KEYS.stripe), `${KEYS.stripe.slice(0, 6)}…`);
    assert.equal(redact("abcd"), "a…");
  });
});

describe("check 2: secrets in history", () => {
  test("an env file any commit touched is flagged at its oldest commit, even if deleted", () => {
    const found = secretsInHistory(
      snapshot({
        envHistory: {
          ".env": ["c".repeat(40), "b".repeat(40)],
          ".env.example": ["d".repeat(40)],
          ".env.local": [],
        },
      }),
    );
    assert.equal(found.length, 1);
    assert.match(found[0].detail, /at bbbbbbb/);
    assert.equal(found[0].visibility, "private");
  });
});

describe("check 3: template leftovers", () => {
  test("starter README, title and page are each caught with their line", () => {
    const files = new Map([
      ["app/layout.tsx", 'export const metadata = {\n  title: "Create Next App",\n};'],
      ["index.html", "<head>\n<title>Vite + React + TS</title>"],
      ["app/page.tsx", "<p>Get started by editing app/page.tsx</p>"],
    ]);
    const found = templateLeftovers(
      snapshot({
        readme:
          "This is a [Next.js](https://nextjs.org) project bootstrapped with `create-next-app`.",
        files,
        tree: ["public/next.svg", "public/vercel.svg"],
      }),
    );
    assert.deepEqual(
      found.map((f) => f.title),
      [
        "The README is still the starter template's",
        "The page title is still Create Next App",
        "The page title is still Vite starter",
        "An untouched create-next-app starter page",
        "The starter's placeholder images are still here",
      ],
    );
    assert.deepEqual(found[1].evidence[0], {
      kind: "file",
      path: "app/layout.tsx",
      startLine: 2,
      endLine: 2,
    });
  });

  test("a project's own README and title are clean", () => {
    const files = new Map([["app/layout.tsx", 'export const metadata = { title: "PulseBoard" };']]);
    assert.deepEqual(
      templateLeftovers(snapshot({ readme: "# PulseBoard\nCrowd analytics for stadiums.", files })),
      [],
    );
  });
});

describe("check 4: setup", () => {
  test("env vars read in code but missing from .env.example", () => {
    const files = new Map([
      [
        "src/a.ts",
        "const k = process.env.OPENAI_API_KEY;\nconst p = process.env.PORT;\nconst u = import.meta.env.VITE_API_URL;",
      ],
      ["api/main.py", 'key = os.environ["GROQ_KEY"]\nx = os.getenv("DB_URL")'],
      [".env.example", "OPENAI_API_KEY=\n"],
    ]);
    assert.deepEqual(
      [...envReads(files).keys()],
      ["OPENAI_API_KEY", "VITE_API_URL", "GROQ_KEY", "DB_URL"],
    );
    const [f] = setupReproducibility(
      snapshot({
        files,
        readme: "npm install\nnpm run dev",
        tree: ["package.json", "package-lock.json"],
      }),
    );
    assert.equal(f.title, "3 env vars aren't in .env.example");
    assert.match(f.detail, /VITE_API_URL, GROQ_KEY, DB_URL/);
  });

  test("no lockfile, no steps, and a README script that doesn't exist", () => {
    const files = new Map([["package.json", '{ "scripts": { "dev": "next dev" } }']]);
    const found = setupReproducibility(
      snapshot({ tree: ["package.json"], files, readme: "Run `npm run seed` first." }),
    );
    assert.deepEqual(
      found.map((f) => f.title),
      [
        "No lockfile",
        "The README doesn't say how to run it",
        "The README runs seed, which package.json doesn't have",
      ],
    );
  });

  test("a runnable repo is clean", () => {
    const files = new Map([["package.json", '{ "scripts": { "dev": "next dev" } }']]);
    assert.deepEqual(
      setupReproducibility(
        snapshot({
          tree: ["package.json", "pnpm-lock.yaml"],
          files,
          readme: "pnpm install\npnpm dev",
        }),
      ),
      [],
    );
  });
});

describe("check 5: README essentials", () => {
  const full = `# PulseBoard
Crowd density for stadium staff, from the cameras they already have.

![screenshot](docs/shot.png)

Live demo: https://pulseboard.vercel.app

## How it works
Cameras stream to a model.

## Tech stack
Next.js, FastAPI.

## Team
Asha, Ben.

## Getting started
npm install && npm run dev`;

  test("a complete README passes all seven", () => {
    assert.ok(Object.values(readmeChecklist(full)).every(Boolean));
    assert.equal(readmeEssentials(snapshot({ readme: full }))[0].outcome, "pass");
  });

  test("a bare README misses most, and says which", () => {
    const [f] = readmeEssentials(snapshot({ readme: "# app\n\nnpm install" }));
    assert.equal(f.outcome, "fail");
    assert.equal(f.title, "README covers 0 of 7 things judges look for");
    assert.match(f.detail, /a demo link, a screenshot or GIF/);
  });
});

describe("check 6: hygiene", () => {
  test("no tests, CI or license; big files; committed node_modules", () => {
    const found = hygiene(
      snapshot({
        tree: ["src/a.ts", "node_modules/x/i.js", "assets/video.mp4"],
        sizes: { "assets/video.mp4": 5 * 1024 * 1024, "node_modules/x/i.js": 9 * 1024 * 1024 },
      }),
    );
    assert.deepEqual(
      found.map((f) => f.title),
      [
        "No tests",
        "No CI",
        "No license",
        "1 files over 1 MB",
        "Dependencies or build output are committed",
      ],
    );
    assert.match(found[3].detail, /assets\/video\.mp4 \(5\.0 MB\)/);
  });

  test("a tidy repo is clean", () => {
    assert.deepEqual(
      hygiene(snapshot({ tree: ["src/a.test.ts", ".github/workflows/ci.yml", "LICENSE"] })),
      [],
    );
  });
});

describe("all checks", () => {
  test("a clean repo yields only the README pass", () => {
    const found = runChecks(
      snapshot({ tree: ["LICENSE", "src/a.test.ts", ".github/workflows/ci.yml"], readme: "" }),
    );
    assert.deepEqual(
      found.map((f) => f.check),
      ["setup", "readme"],
    );
  });
});

describe("collecting the snapshot", () => {
  test("env files first, then the usual suspects, then code shallowest first; nothing vendored or huge", () => {
    const tree = [
      "src/deep/x/y.ts",
      "src/a.ts",
      ".env",
      "app/layout.tsx",
      "node_modules/z/i.js",
      "big.json",
      "logo.png",
      "package.json",
    ];
    assert.deepEqual(pickCheckFiles(tree, { "big.json": 5 * 1024 * 1024 }), [
      ".env",
      "app/layout.tsx",
      "package.json",
      "src/a.ts",
      "src/deep/x/y.ts",
    ]);
  });

  test("history is traced for the usual env files even when they're gone", () => {
    assert.deepEqual(envPathsToTrace(["server/.env"]), [
      ".env",
      ".env.local",
      ".env.production",
      "server/.env",
    ]);
  });

  test("the snapshot keeps only what could be read", async () => {
    const s = await collectSnapshot(
      { repo: "t/a", tree: ["a.ts", "b.ts"], sizes: {}, readme: "# a" },
      { read: async (p) => (p === "a.ts" ? "x" : null), commits: async () => [] },
    );
    assert.deepEqual([...s.files.keys()], ["a.ts"]);
  });
});
