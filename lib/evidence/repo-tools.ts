// The verification agent's tools over one repo at one commit: list_tree, read_file, search
// and read_manifest. Every call spends from a budget (40 calls, 600 KB read, a deadline);
// vendored, lock, minified and generated paths are never shown. Each line range read is
// recorded, so a citation can be checked against what the agent actually saw.

import { isReadablePath } from "../sources";

export const TOOL_BUDGET = { calls: 40, bytes: 600 * 1024 };
const MAX_LIST = 200;
const MAX_LINES_PER_READ = 400;
const MAX_MATCHES = 50;
const MAX_PATTERN = 200;
const MANIFEST =
  /(^|\/)(package\.json|requirements\.txt|pyproject\.toml|Pipfile|go\.mod|Cargo\.toml|Gemfile|composer\.json|pom\.xml|build\.gradle(\.kts)?|pubspec\.yaml)$/;

/** Where the files come from: the tree at the commit, and a reader for one file's text. */
export type RepoReader = {
  tree: readonly string[];
  read: (path: string) => Promise<string | null>;
};

export class ToolSession {
  calls = 0;
  bytes = 0;
  /** Every file fetched, by path. */
  readonly files = new Map<string, string>();
  /** The 1-based line ranges shown to the agent, by path. */
  readonly seen = new Map<string, [number, number][]>();
  private readonly visible: string[];

  constructor(
    private readonly repo: RepoReader,
    private readonly deadline: number,
    private readonly limits = TOOL_BUDGET,
    private readonly now: () => number = Date.now,
  ) {
    this.visible = repo.tree.filter(isReadablePath);
  }

  get exhausted(): boolean {
    return (
      this.calls >= this.limits.calls ||
      this.bytes >= this.limits.bytes ||
      this.now() >= this.deadline
    );
  }

  /** Runs one tool call. Errors come back as text for the agent, never thrown. */
  async run(name: string, input: unknown): Promise<string> {
    if (this.exhausted)
      return "Budget exhausted. Give your verdicts now; anything you couldn't check is cant_verify.";
    this.calls++;
    const args = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
    switch (name) {
      case "list_tree":
        return this.listTree(typeof args.path === "string" ? args.path : "");
      case "read_file":
        return this.readFile(
          String(args.path ?? ""),
          Number(args.start ?? 1),
          Number(args.end ?? MAX_LINES_PER_READ),
        );
      case "search":
        return this.search(String(args.pattern ?? ""));
      case "read_manifest":
        return this.readManifest(typeof args.path === "string" ? args.path : null);
      default:
        return `Unknown tool ${name}.`;
    }
  }

  listTree(path: string): string {
    const prefix = path.replace(/^\.?\/+|\/+$/g, "");
    const under = this.visible.filter((p) => !prefix || p === prefix || p.startsWith(`${prefix}/`));
    if (!under.length) return `Nothing under ${prefix || "the root"}.`;
    const shown = under.slice(0, MAX_LIST);
    return [
      ...shown,
      ...(under.length > shown.length ? [`... and ${under.length - shown.length} more`] : []),
    ].join("\n");
  }

  private async fetch(path: string): Promise<string | null> {
    if (this.files.has(path)) return this.files.get(path)!;
    if (!this.visible.includes(path)) return null;
    const text = await this.repo.read(path);
    if (text === null) return null;
    this.files.set(path, text);
    return text;
  }

  async readFile(path: string, start: number, end: number): Promise<string> {
    const clean = path.replace(/^\.?\/+/, "");
    if (!isReadablePath(clean))
      return `${clean} isn't readable (vendored, generated, binary, lock or env file).`;
    const text = await this.fetch(clean);
    if (text === null) return `${clean} doesn't exist in the repo or can't be read.`;
    const lines = text.split(/\r?\n/);
    const from = Math.max(1, Number.isFinite(start) ? Math.floor(start) : 1);
    const to = Math.min(
      lines.length,
      from + MAX_LINES_PER_READ - 1,
      Number.isFinite(end) ? Math.floor(end) : lines.length,
    );
    if (from > lines.length) return `${clean} has only ${lines.length} lines.`;
    const shown = lines.slice(from - 1, to);
    const body = shown.map((l, i) => `${from + i}: ${l}`).join("\n");
    this.bytes += Buffer.byteLength(body);
    this.seen.set(clean, [...(this.seen.get(clean) ?? []), [from, to]]);
    const more =
      to < lines.length ? `\n(${lines.length - to} more lines; read from ${to + 1})` : "";
    return `${clean} lines ${from}-${to} of ${lines.length}:\n${body}${more}`;
  }

  /** A case-insensitive search over the files already fetched. Plain text unless it's a valid regex. */
  search(pattern: string): string {
    if (!pattern || pattern.length > MAX_PATTERN) return "Give a pattern under 200 characters.";
    let re: RegExp;
    try {
      re = new RegExp(pattern, "i");
    } catch {
      re = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    }
    const hits: string[] = [];
    for (const [path, text] of this.files) {
      text.split(/\r?\n/).forEach((line, i) => {
        if (hits.length < MAX_MATCHES && re.test(line))
          hits.push(`${path}:${i + 1}: ${line.trim().slice(0, 200)}`);
      });
    }
    if (!this.files.size)
      return "No files fetched yet. Read a file first; search only covers files already read.";
    return hits.length
      ? hits.join("\n")
      : `No matches in the ${this.files.size} files read so far.`;
  }

  async readManifest(path: string | null): Promise<string> {
    const target =
      path ??
      this.visible
        .filter((p) => MANIFEST.test(p))
        .sort((a, b) => a.split("/").length - b.split("/").length)[0];
    if (!target || !MANIFEST.test(target)) return "No dependency manifest found.";
    return this.readFile(target, 1, MAX_LINES_PER_READ);
  }

  /** True if every line from start to end was shown to the agent in some read. */
  wasShown(path: string, start: number, end: number): boolean {
    const ranges = this.seen.get(path) ?? [];
    for (let line = start; line <= end; line++)
      if (!ranges.some(([a, b]) => line >= a && line <= b)) return false;
    return start >= 1 && end >= start;
  }
}

/** The tool definitions the model sees. */
export const TOOL_DEFS = [
  {
    name: "list_tree",
    description:
      "List file paths in the repo under a folder (empty for the root). Vendored, generated and binary files are left out.",
    input_schema: {
      type: "object" as const,
      properties: { path: { type: "string" } },
      required: [],
    },
  },
  {
    name: "read_file",
    description:
      "Read a file's lines, numbered, at the commit being judged. At most 400 lines per call.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: { type: "string" },
        start: { type: "integer", minimum: 1 },
        end: { type: "integer", minimum: 1 },
      },
      required: ["path"],
    },
  },
  {
    name: "search",
    description:
      "Search the files you've already read for a pattern (case-insensitive). Returns path:line: text.",
    input_schema: {
      type: "object" as const,
      properties: { pattern: { type: "string" } },
      required: ["pattern"],
    },
  },
  {
    name: "read_manifest",
    description:
      "Read a dependency manifest (package.json, requirements.txt, pyproject.toml...). Without a path, the shallowest one.",
    input_schema: {
      type: "object" as const,
      properties: { path: { type: "string" } },
      required: [],
    },
  },
];
