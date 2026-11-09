// Which files the scan reads, and how much of each. Pure, so the rules are testable: the
// fetch itself lives in github.ts.

export const MAX_SOURCES = 10;
// 6,000 cut half the files a real scan read, and a cut file can only ever be "unclear".
export const SOURCE_CHARS = 12_000;

/**
 * A file the scan fetched and the model read. Its text is untrusted. `truncated`: the file
 * is longer than SOURCE_CHARS, so not seeing something in `text` proves nothing.
 */
export type Source = { path: string; text: string; truncated?: boolean };

const LOCKFILE = /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?|poetry\.lock|Pipfile\.lock|Cargo\.lock|Gemfile\.lock|composer\.lock|go\.sum|uv\.lock)$/i;
const GENERATED_DIR = /(^|\/)(node_modules|dist|build|out|\.next|\.nuxt|\.svelte-kit|coverage|vendor|__pycache__|\.venv|venv|generated|__generated__|target)\//i;
const MINIFIED = /\.min\.(js|css|mjs)$|[.-]bundle\.js$|\.chunk\.js$/i;
const BINARY = /\.(png|jpe?g|gif|webp|avif|ico|bmp|tiff?|svg|psd|mp3|wav|ogg|mp4|mov|webm|avi|woff2?|ttf|otf|eot|pdf|zip|gz|tgz|rar|7z|tar|jar|exe|dll|so|dylib|bin|wasm|onnx|pt|pth|h5|pkl|gguf|safetensors|npy|npz|parquet|db|sqlite3?|ipynb|map|pyc|class|o|a|lockb)$/i;

// Env files can hold real keys. Their contents would be stored and could be quoted in a
// review, so only the templates are read.
const ENV = /(^|\/)\.env(\.|$)/i;
const ENV_TEMPLATE = /(^|\/)\.env\.(example|sample|template)$/i;

/** Lockfiles, build output, minified bundles, binaries and env files are never read. */
export function isReadablePath(path: string): boolean {
  if (ENV.test(path) && !ENV_TEMPLATE.test(path)) return false;
  return !LOCKFILE.test(path) && !GENERATED_DIR.test(path) && !MINIFIED.test(path) && !BINARY.test(path);
}

/**
 * The text worth showing the model, cut to SOURCE_CHARS. Null for binaries (NUL bytes),
 * minified code (very long lines) and files marked as generated.
 */
export function readableText(text: string): string | null {
  if (text.includes("\u0000")) return null;
  const head = text.slice(0, 20_000);
  const lines = head.split("\n");
  const longest = lines.reduce((m, l) => Math.max(m, l.length), 0);
  if (longest > 2000 || (head.length > 2000 && head.length / lines.length > 250)) return null;
  if (/@generated|auto-?generated|do not edit/i.test(text.slice(0, 400))) return null;
  return text.slice(0, SOURCE_CHARS);
}

/**
 * The files to fetch: every claim's first candidate, then every claim's second, skipping
 * unreadable paths and repeats, up to MAX_SOURCES.
 */
export function pickFiles(candidates: readonly (readonly string[])[], limit = MAX_SOURCES): string[] {
  const picked: string[] = [];
  const most = Math.max(0, ...candidates.map((c) => c.length));
  for (let rank = 0; rank < most; rank++) {
    for (const c of candidates) {
      const p = c[rank];
      if (picked.length >= limit) return picked;
      if (p && isReadablePath(p) && !picked.includes(p)) picked.push(p);
    }
  }
  return picked;
}
