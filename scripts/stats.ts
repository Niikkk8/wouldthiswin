// npm run stats [-- --days 14]
// Sessions per day, cost per session (average and p95), cost by step, cache hit rate and the
// funnel, from the sessions and session_usage tables. Read-only.

import { db } from "../lib/db";
import { computeStats, type SessionRow, type UsageRow } from "../lib/stats";

const PAGE = 1000;

async function all<T>(table: string, columns: string, since: string): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db()
      .from(table)
      .select(columns)
      .gte("created_at", since)
      .order("created_at")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data as T[]));
    if (data.length < PAGE) return rows;
  }
}

function daysArg(argv: string[]): number {
  const i = argv.indexOf("--days");
  const n = i >= 0 ? Number(argv[i + 1]) : 14;
  return Number.isInteger(n) && n > 0 ? n : 14;
}

const usd = (n: number) => `$${n.toFixed(4)}`;
const pct = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : "-");

async function main() {
  const days = daysArg(process.argv.slice(2));
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const [sessions, usage] = await Promise.all([
    all<SessionRow>("sessions", "id, created_at, act, shareable", since),
    all<UsageRow>(
      "session_usage",
      "session_id, step, model, input_tokens, cache_read_tokens, cache_write_tokens, usd, duration_ms",
      since,
    ),
  ]);
  const s = computeStats(sessions, usage);
  const out = process.stdout;

  out.write(`Last ${days} days\n\nSessions per day\n`);
  for (const d of s.perDay) out.write(`  ${d.day}  ${d.sessions}\n`);

  out.write(`\nCost per session (${s.cost.sessions} sessions with model calls)\n`);
  out.write(`  average ${usd(s.cost.avgUsd)}   p95 ${usd(s.cost.p95Usd)}   total ${usd(s.cost.totalUsd)}\n`);

  out.write(`\nCost by step\n`);
  for (const st of s.byStep) {
    out.write(`  ${st.step.padEnd(18)} ${String(st.calls).padStart(6)} calls  ${usd(st.usd).padStart(10)}  avg ${st.avgMs} ms\n`);
  }

  out.write(`\nPrompt cache hit rate  ${(s.cacheHitRate * 100).toFixed(1)}%\n`);

  const f = s.funnel;
  out.write(`\nFunnel\n`);
  out.write(`  started            ${f.started}\n`);
  out.write(`  finished grilling  ${f.finishedGrilling}  (${pct(f.finishedGrilling, f.started)})\n`);
  out.write(`  reached verdict    ${f.reachedVerdict}  (${pct(f.reachedVerdict, f.started)})\n`);
  out.write(`  made shareable     ${f.madeShareable}  (${pct(f.madeShareable, f.started)})\n`);
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
