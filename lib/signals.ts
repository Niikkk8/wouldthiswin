import type { DemoCheck } from "./demo-check";
import type { RawRepoData } from "./github";

export const FIRST_COMMIT_BULK_THRESHOLD = 0.7;

export type Signals = {
  commitCount: number;
  firstCommitAt: string;
  lastCommitAt: string;
  commitSpanHours: number;
  /** Share of current files that were added by the first commit (0-1), null if unknown. */
  firstCommitFileShare: number | null;
  /** True if the first commit added more than 70% of files, or if we couldn't see its full file list. */
  firstCommitAddedOver70Pct: boolean;
  /** The first commit's file list was truncated by GitHub, so the flag above was forced on. */
  firstCommitFilesTruncated: boolean;
  readmeLength: number;
  readmeHasImages: boolean;
  stack: string[];
  demo: { provided: false } | ({ provided: true } & DemoCheck);
};

/** Badges are images technically, but they say nothing about the project. */
const BADGE =
  /shields\.io|badgen\.net|badge\.fury\.io|codecov\.io|coveralls\.io|travis-ci|circleci\.com|\/badge\.svg|\/badges?\//i;

export function readmeHasImages(readme: string): boolean {
  const sources: string[] = [];
  for (const m of readme.matchAll(/!\[[^\]]*\]\(\s*<?([^)\s>]+)/g)) sources.push(m[1]); // ![alt](src)
  for (const m of readme.matchAll(/<(?:img|video|source)\b[^>]*\bsrc\s*=\s*["']?([^"'\s>]+)/gi)) {
    sources.push(m[1]);
  }
  // Reference-style ![alt][ref] → [ref]: url
  for (const m of readme.matchAll(/^\s*\[[^\]]+\]:\s*<?(\S+?)>?(?:\s|$)/gm)) {
    if (/\.(png|jpe?g|gif|webp|svg|avif|mp4|webm|mov)(\?|#|$)/i.test(m[1])) sources.push(m[1]);
  }
  // Bare GitHub attachment links render as images/videos on their own line.
  for (const m of readme.matchAll(
    /https:\/\/(?:github\.com\/user-attachments\/assets|user-images\.githubusercontent\.com)\/\S+/g,
  )) {
    sources.push(m[0]);
  }
  return sources.some((s) => !BADGE.test(s));
}

const NPM_STACK: Record<string, string> = {
  next: "Next.js",
  react: "React",
  "react-native": "React Native",
  expo: "Expo",
  vue: "Vue",
  nuxt: "Nuxt",
  svelte: "Svelte",
  "@sveltejs/kit": "SvelteKit",
  "solid-js": "Solid",
  astro: "Astro",
  "@angular/core": "Angular",
  "@remix-run/react": "Remix",
  vite: "Vite",
  electron: "Electron",
  express: "Express",
  fastify: "Fastify",
  hono: "Hono",
  "@nestjs/core": "NestJS",
  tailwindcss: "Tailwind",
  three: "Three.js",
  "@supabase/supabase-js": "Supabase",
  firebase: "Firebase",
  "firebase-admin": "Firebase",
  prisma: "Prisma",
  "@prisma/client": "Prisma",
  "drizzle-orm": "Drizzle",
  mongoose: "MongoDB",
  convex: "Convex",
  "@anthropic-ai/sdk": "Anthropic API",
  openai: "OpenAI API",
  "@google/generative-ai": "Gemini API",
  "@google/genai": "Gemini API",
  ai: "Vercel AI SDK",
  langchain: "LangChain",
  "@langchain/core": "LangChain",
  ethers: "Ethers",
  viem: "Viem",
  "socket.io": "Socket.IO",
  stripe: "Stripe",
};

const PY_STACK: Record<string, string> = {
  flask: "Flask",
  django: "Django",
  fastapi: "FastAPI",
  streamlit: "Streamlit",
  gradio: "Gradio",
  torch: "PyTorch",
  tensorflow: "TensorFlow",
  transformers: "Hugging Face Transformers",
  "scikit-learn": "scikit-learn",
  sklearn: "scikit-learn",
  pandas: "pandas",
  numpy: "NumPy",
  opencv_python: "OpenCV",
  "opencv-python": "OpenCV",
  langchain: "LangChain",
  llama_index: "LlamaIndex",
  "llama-index": "LlamaIndex",
  openai: "OpenAI API",
  anthropic: "Anthropic API",
  "google-generativeai": "Gemini API",
  "google-genai": "Gemini API",
  supabase: "Supabase",
  "firebase-admin": "Firebase",
  web3: "Web3.py",
};

/** Root-level files that identify a stack. */
const FILE_STACK: [RegExp, string][] = [
  [/^Cargo\.toml$/, "Rust"],
  [/^go\.mod$/, "Go"],
  [/^pubspec\.yaml$/, "Flutter"],
  [/^Gemfile$/, "Ruby"],
  [/^composer\.json$/, "PHP"],
  [/^(pom\.xml|build\.gradle(\.kts)?)$/, "JVM"],
  [/^Package\.swift$/, "Swift"],
  [/\.xcodeproj$/, "Xcode"],
  [/^(pyproject\.toml|setup\.py)$/, "Python"],
  [/^Dockerfile$/, "Docker"],
  [/^hardhat\.config\.(js|ts)$/, "Hardhat"],
  [/^foundry\.toml$/, "Foundry"],
  [/^vercel\.json$/, "Vercel"],
  [/^supabase$/, "Supabase"],
];

function npmDeps(packageJson: string | null): string[] {
  if (!packageJson) return [];
  try {
    const pkg = JSON.parse(packageJson) as Record<string, unknown>;
    const keys = (o: unknown) => (o && typeof o === "object" ? Object.keys(o) : []);
    return [...keys(pkg.dependencies), ...keys(pkg.devDependencies)];
  } catch {
    return [];
  }
}

function pyDeps(requirements: string | null): string[] {
  if (!requirements) return [];
  return requirements
    .split(/\r?\n/)
    .map((l) => l.replace(/#.*/, "").trim())
    .filter((l) => l && !l.startsWith("-"))
    .map((l) => l.split(/[\s<>=!~;\[@]/)[0].toLowerCase());
}

export function detectStack(
  raw: Pick<RawRepoData, "packageJson" | "requirementsTxt" | "tree" | "meta">,
): string[] {
  const out = new Set<string>();
  if (raw.meta.language) out.add(raw.meta.language);
  if (raw.packageJson) out.add("Node.js");
  if (raw.requirementsTxt) out.add("Python");
  for (const d of npmDeps(raw.packageJson)) if (NPM_STACK[d]) out.add(NPM_STACK[d]);
  for (const d of pyDeps(raw.requirementsTxt)) if (PY_STACK[d]) out.add(PY_STACK[d]);
  for (const e of raw.tree) {
    if (e.path.includes("/")) continue;
    for (const [re, name] of FILE_STACK) if (re.test(e.path)) out.add(name);
  }
  if (raw.tree.some((e) => e.path.endsWith(".ipynb"))) out.add("Jupyter");
  return [...out];
}

function hoursBetween(a: string, b: string): number {
  const ms = Date.parse(b) - Date.parse(a);
  return Number.isFinite(ms) ? Math.round((ms / 3_600_000) * 10) / 10 : 0;
}

export function computeSignals(raw: RawRepoData, demo: DemoCheck | null): Signals {
  const firstCommitAt = raw.rootCommit.date;
  const lastCommitAt = raw.commits[0]?.date ?? firstCommitAt;

  // Share of HEAD's files that already existed in the root commit.
  let share: number | null = null;
  if (raw.headFilePaths.length > 0) {
    const root = new Set(raw.rootCommit.filePaths);
    const fromRoot = raw.headFilePaths.filter((p) => root.has(p)).length;
    share = Math.round((fromRoot / raw.headFilePaths.length) * 100) / 100;
  }
  // If GitHub truncated the root commit's file list we can't see how big it
  // really was, so assume the worst rather than let truncation hide it.
  const truncated = raw.rootCommit.treeTruncated;
  const over70 = truncated || (share !== null && share > FIRST_COMMIT_BULK_THRESHOLD);

  return {
    commitCount: raw.commitCount,
    firstCommitAt,
    lastCommitAt,
    commitSpanHours: hoursBetween(firstCommitAt, lastCommitAt),
    firstCommitFileShare: truncated ? null : share,
    firstCommitAddedOver70Pct: over70,
    firstCommitFilesTruncated: truncated,
    readmeLength: raw.readmeFull.length,
    readmeHasImages: readmeHasImages(raw.readmeFull),
    stack: detectStack(raw),
    demo: demo ? { provided: true, ...demo } : { provided: false },
  };
}
