// Which files act 1 draws. A repo can have thousands; the scan view shows the files the
// claims point at, their folders, a couple of neighbours, and the top level.

const MAX_ROWS = 18;
/** OS clutter nobody wants to see in their tree. */
const JUNK = /(^|\/)(\.DS_Store|Thumbs\.db|desktop\.ini)$/i;
const TOP_LEVEL = 8;
const SIBLINGS = 2;

/** Folders end in "/". */
const parentOf = (path: string) => {
  const trimmed = path.endsWith("/") ? path.slice(0, -1) : path;
  const i = trimmed.lastIndexOf("/");
  return i < 0 ? "" : trimmed.slice(0, i + 1);
};

function ancestors(path: string): string[] {
  const out: string[] = [];
  for (let p = parentOf(path); p; p = parentOf(p)) out.push(p);
  return out;
}

/** Tree order: at each level, folders before files, then alphabetical. A folder comes before its contents. */
export function treeCompare(a: string, b: string): number {
  const key = (p: string) => {
    const dir = p.endsWith("/");
    const parts = (dir ? p.slice(0, -1) : p).split("/");
    return parts.map((seg, i) => (i < parts.length - 1 || dir ? "0" : "1") + seg.toLowerCase());
  };
  const ak = key(a);
  const bk = key(b);
  for (let i = 0; i < Math.min(ak.length, bk.length); i++) {
    if (ak[i] !== bk[i]) return ak[i] < bk[i] ? -1 : 1;
  }
  return ak.length - bk.length;
}

/** True if the path is a file in the repo or a folder that contains one. */
export function pathExists(files: readonly string[] | Set<string>, path: string): boolean {
  const set = files instanceof Set ? files : new Set(files);
  if (set.has(path)) return true;
  const dir = path.endsWith("/") ? path : `${path}/`;
  for (const f of set) if (f.startsWith(dir)) return true;
  return false;
}

export function displayTree(
  allFiles: readonly string[],
  claims: readonly { file: string | null; searched: string[] }[],
): string[] {
  const files = allFiles.filter((f) => !JUNK.test(f));
  const rows = new Set<string>();
  const add = (p: string) => {
    rows.add(p);
    for (const a of ancestors(p)) rows.add(a);
  };

  const cited = claims.flatMap((c) => [...(c.file ? [c.file] : []), ...c.searched]);
  for (const p of cited) add(p);

  // A couple of neighbours, so a cited file doesn't sit alone in its folder.
  for (const p of cited) {
    const dir = parentOf(p);
    if (!dir) continue;
    const siblings = files.filter((f) => parentOf(f) === dir && f !== p).slice(0, SIBLINGS);
    for (const s of siblings) if (rows.size < MAX_ROWS) rows.add(s);
  }

  // The top level, folders first.
  const top = [...new Set(files.map((f) => (f.includes("/") ? `${f.split("/")[0]}/` : f)))]
    .sort(treeCompare)
    .slice(0, TOP_LEVEL);
  for (const t of top) if (rows.size < MAX_ROWS) rows.add(t);

  return [...rows].sort(treeCompare);
}
