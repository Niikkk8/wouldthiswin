import type { DemoCheck } from "./demo-check";
import type { RawRepoData } from "./github";

export const FIRST_COMMIT_BULK_THRESHOLD = 0.7;

/** How the project will be judged, as told by the team. Changes what "demo" means. */
export const FORMATS = ["in-person", "online", "unknown"] as const;
export type JudgingFormat = (typeof FORMATS)[number];

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
  /** A demo video is linked or embedded (YouTube, Loom, Vimeo, mp4...). Online judges watch this first. */
  readmeHasVideo: boolean;
  /** A deployed link is in the README or the repo's homepage field. */
  hasLiveLink: boolean;
  /** The README is still a framework starter (create-next-app, Vite, CRA...). */
  readmeIsTemplate: boolean;
  /** The README opens with setup steps instead of saying what the project is. */
  readmeOpensWithSetup: boolean;
  /** Hours covered by the newest 90% of the fetched commits: the real build window. */
  coreWindowHours: number;
  /** Share of fetched commits within 48h of the last commit (0-1). */
  shareInFinal48h: number;
  /** Distinct commit authors among the fetched commits. */
  authors: number;
  /** A real .env file (not .env.example) is in the repo. */
  committedEnvFile: boolean;
  /** node_modules, venv or similar is committed. */
  committedDependencies: boolean;
  /** LLM SDKs in the dependency files; the core of "is this a wrapper?". */
  llmSdks: string[];
  stack: string[];
  format: JudgingFormat;
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

// ---------- README shape ----------

const VIDEO =
  /youtu\.?be|youtube\.com\/(watch|embed|shorts)|loom\.com\/(share|embed)|vimeo\.com\/\d|drive\.google\.com\/file|streamable\.com|\.(mp4|webm|mov)(\?|#|\)|"|\s|$)|github\.com\/user-attachments\/assets/i;

const LIVE_HOSTS =
  /https?:\/\/[^\s)"'<>]*\b(vercel\.app|netlify\.app|github\.io|pages\.dev|onrender\.com|railway\.app|fly\.dev|herokuapp\.com|streamlit\.app|huggingface\.co\/spaces|replit\.app|surge\.sh|firebaseapp\.com|web\.app|expo\.dev|glitch\.me|azurewebsites\.net|appspot\.com)/i;

const TEMPLATE_README =
  /bootstrapped with [[`]*create-next-app|bootstrapped with [[`]*create[- ]react[- ]app|this template provides a minimal setup to get react working in vite|# react \+ (typescript \+ )?vite|# vue 3 \+ vite|everything you need to build a svelte project|welcome to your expo app|# astro starter kit|getting started with create react app/i;

const SETUP_HEADING =
  /^(getting started|installation|install|setup|set up|prerequisites|requirements|how to run|running locally|quick ?start|usage)\b/i;

export function readmeHasVideo(readme: string): boolean {
  return VIDEO.test(readme);
}

/** True when the first thing a reader meets is setup, not what the project does. */
export function readmeOpensWithSetup(readme: string): boolean {
  const lines = readme
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !/^!\[|^<img|^<p|^<\/|^\[!\[|^<div|^<br|^---$/.test(l));
  // Skip the title line; look at what comes straight after it.
  const rest = lines[0]?.startsWith("#") ? lines.slice(1) : lines;
  const first = rest[0] ?? "";
  if (!first) return false;
  if (first.startsWith("#")) return SETUP_HEADING.test(first.replace(/^#+\s*/, ""));
  return /^(\$ |```|npm |npx |yarn |pnpm |pip |git clone|cd )/.test(first);
}

// ---------- commit timeline ----------

/** Hours between the newest commit and the commit that closes out the newest 90%. */
function coreWindowHours(commits: { date: string }[]): number {
  const times = commits.map((c) => Date.parse(c.date)).filter(Number.isFinite);
  if (times.length < 2) return 0;
  const idx = Math.min(times.length - 1, Math.ceil(times.length * 0.9) - 1);
  return Math.round(((times[0] - times[idx]) / 3_600_000) * 10) / 10;
}

function shareInFinal(commits: { date: string }[], hours: number): number {
  const times = commits.map((c) => Date.parse(c.date)).filter(Number.isFinite);
  if (!times.length) return 0;
  const cutoff = times[0] - hours * 3_600_000;
  return Math.round((times.filter((t) => t >= cutoff).length / times.length) * 100) / 100;
}

// ---------- repo hygiene ----------

const ENV_FILE = /(^|\/)\.env(\.(local|development|production|prod|dev))?$/i;
const DEP_DIRS = /(^|\/)(node_modules|venv|\.venv|env\/lib|__pycache__|vendor\/bundle)(\/|$)/;

const LLM_SDKS: Record<string, string> = {
  openai: "OpenAI",
  "@anthropic-ai/sdk": "Anthropic",
  anthropic: "Anthropic",
  "@google/generative-ai": "Gemini",
  "@google/genai": "Gemini",
  "google-generativeai": "Gemini",
  "google-genai": "Gemini",
  ai: "Vercel AI SDK",
  langchain: "LangChain",
  "@langchain/core": "LangChain",
  "@langchain/openai": "LangChain",
  "groq-sdk": "Groq",
  groq: "Groq",
  "cohere-ai": "Cohere",
  cohere: "Cohere",
  replicate: "Replicate",
  "llama-index": "LlamaIndex",
  llama_index: "LlamaIndex",
  ollama: "Ollama",
  mistralai: "Mistral",
  "@mistralai/mistralai": "Mistral",
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

export function computeSignals(
  raw: RawRepoData,
  demo: DemoCheck | null,
  format: JudgingFormat = "unknown",
): Signals {
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
    readmeHasVideo: readmeHasVideo(raw.readmeFull),
    hasLiveLink: LIVE_HOSTS.test(raw.readmeFull) || Boolean(raw.meta.homepage),
    readmeIsTemplate: TEMPLATE_README.test(raw.readmeFull),
    readmeOpensWithSetup: readmeOpensWithSetup(raw.readmeFull),
    coreWindowHours: coreWindowHours(raw.commits),
    shareInFinal48h: shareInFinal(raw.commits, 48),
    authors: new Set(raw.commits.map((c) => c.author.toLowerCase()).filter(Boolean)).size,
    committedEnvFile: raw.headFilePaths.some((p) => ENV_FILE.test(p)),
    committedDependencies: raw.headFilePaths.some((p) => DEP_DIRS.test(p)),
    llmSdks: [
      ...new Set(
        [...npmDeps(raw.packageJson), ...pyDeps(raw.requirementsTxt)]
          .map((d) => LLM_SDKS[d])
          .filter(Boolean),
      ),
    ],
    stack: detectStack(raw),
    format,
    demo: demo ? { provided: true, ...demo } : { provided: false },
  };
}
