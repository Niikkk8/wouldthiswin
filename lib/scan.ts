// The scan:
//   1. claims from the README, the Devpost page and the pasted submission (Haiku, lib/evidence/extract);
//   2. each claim checked against the code by the verification agent (Sonnet, lib/evidence/verify);
//   3. the panel's questions, written from what the check found (Haiku, lib/grill/questions);
// plus the signals measured in code (the demo link, the first commit). The model never sets odds.

import { SwampedError } from "./anthropic-retry";
import { parseDemoLink } from "./demo-link";
import { checkDemoLink } from "./demo-link-check";
import { sourcesFrom, toClaims } from "./evidence/claims";
import { ExtractError, extractClaims, type ExtractedClaim } from "./evidence/extract";
import type { RepoReader } from "./evidence/repo-tools";
import { claimSources, fetchDevpost, type Devpost } from "./evidence/sources";
import { verifyClaims, type Verdict } from "./evidence/verify";
import { collectSnapshot } from "./checks/collect";
import { checkDemos, demoCandidates } from "./checks/demo";
import { fetchPage } from "./demo-check";
import { runChecks } from "./checks";
import type { Finding } from "./findings";
import { commitsTouching, readFileAt, readRawAt, type RawRepoData } from "./github";
import { QuestionsError, buildQuestionsPrompt, writeQuestions, type WrittenQuestion } from "./grill/questions";
import { log } from "./log";
import { newUsage, type Usage } from "./model";
import { HAIKU } from "./pricing";
import { noEmit, type Emit } from "./scan-progress";
import type { Claim, Scan, ScanSignals } from "./session";
import { computeSignals, findDemoUrl } from "./signals";
import type { Source } from "./sources";

/** The model for small calls: questions, answer scores, the deliberation, the re-review. */
export const MODEL = HAIKU;
const STORED_FILES = 3000;

export class ScanError extends Error {
  constructor(
    message: string,
    public usage: Usage,
    /** Anthropic was busy (429/529) through every retry: not the repo's fault, not counted. */
    public swamped = false,
  ) {
    super(message);
    this.name = "ScanError";
  }
}

/** A re-review: what the panel asked for last round, so the questions can follow up. */
export type PreviousRound = { fixes: readonly string[] };

/** What the team added beyond the repo. */
export type SubmissionInput = { devpostUrl: string | null; text: string | null };

/** The steps of the scan, swappable in tests. */
export type ScanDeps = {
  extract: (sources: ReturnType<typeof claimSources>, usage: Usage) => Promise<ExtractedClaim[]>;
  verify: (
    claims: ExtractedClaim[],
    repo: RepoReader,
    usage: Usage,
    onRead: (path: string) => void,
  ) => Promise<{ verdicts: Verdict[]; files: ReadonlyMap<string, string> }>;
  questions: (prompt: { system: string; user: string }, usage: Usage) => Promise<WrittenQuestion[]>;
  devpost: (url: string) => Promise<Devpost | null>;
  read: (raw: RawRepoData, path: string) => Promise<string | null>;
};

const realDeps: ScanDeps = {
  extract: (sources, usage) => extractClaims(sources, usage),
  verify: async (claims, repo, usage, onRead) => {
    const r = await verifyClaims(claims, repo, usage, { onRead });
    return { verdicts: r.verdicts, files: r.tools.files };
  },
  questions: (prompt, usage) => writeQuestions(prompt, usage),
  devpost: (url) => fetchDevpost(url),
  read: (raw, path) => readFileAt(raw.ref, raw.latestSha, path),
};

export type ScanModelResult = { claims: Claim[]; questions: WrittenQuestion[]; sources: Source[]; usage: Usage };

/** Claims, verification, questions. A failed extraction or question call fails the scan; a failed check doesn't. */
export async function runScanModel(
  raw: RawRepoData,
  opts: {
    emit?: Emit;
    previous?: PreviousRound | null;
    eventContext?: string;
    submission?: SubmissionInput | null;
    /** Already fetched by the caller, so the demo check can share it. */
    devpost?: Devpost | null;
    deps?: Partial<ScanDeps>;
  } = {},
): Promise<ScanModelResult> {
  const deps = { ...realDeps, ...opts.deps };
  const emit = opts.emit ?? noEmit;
  const usage = newUsage();
  const wrap = (err: unknown): never => {
    const swamped = err instanceof SwampedError || ((err instanceof ExtractError || err instanceof QuestionsError) && err.swamped);
    throw new ScanError(err instanceof Error ? err.message : String(err), usage, swamped);
  };

  const devpost =
    opts.devpost !== undefined ? opts.devpost : opts.submission?.devpostUrl ? await deps.devpost(opts.submission.devpostUrl).catch(() => null) : null;
  const sources = claimSources({ readme: raw.readmeFull, devpost, submission: opts.submission?.text ?? null });
  const extracted = await deps.extract(sources, usage).catch(wrap);
  emit({ type: "claims", claims: extracted.map((c) => c.text) });

  emit({ type: "checking", claims: extracted.length });
  const repo: RepoReader = { tree: raw.headFilePaths, read: (path) => deps.read(raw, path) };
  const checked = await deps
    .verify(extracted, repo, usage, (path) => {
      emit({ type: "reading", path });
      emit({ type: "read", path, ok: true });
    })
    .catch((err: unknown) => {
      // Reading nothing is safe: every claim comes back "couldn't verify", none "missing".
      log.warn("scan.verify.failed", { repo: raw.ref.url, error: String(err) });
      return { verdicts: [] as Verdict[], files: new Map<string, string>() };
    });
  const claims = toClaims(extracted, checked.verdicts, checked.files);

  const prompt = buildQuestionsPrompt({
    repo: raw.meta.fullName,
    description: raw.meta.description,
    claims,
    previousFixes: opts.previous?.fixes,
    eventContext: opts.eventContext,
  });
  const questions = await deps.questions(prompt, usage).catch(wrap);
  return { claims, questions, sources: sourcesFrom(checked.files, checked.verdicts), usage };
}

/** Checks a demo link and records it the way the session stores it. */
export async function demoSignal(url: string | null, provided: boolean): Promise<ScanSignals["demo"]> {
  const link = url ? parseDemoLink(url) : null;
  const status = await checkDemoLink(link);
  return { status, url: status === "none" ? null : (link?.url ?? null), ...(provided ? { provided } : {}) };
}

/** The deterministic checks over a snapshot of the repo. A failure leaves no findings, never a guess. */
async function deterministicChecks(raw: RawRepoData, devpost: Devpost | null): Promise<Finding[]> {
  try {
    const demos = demoCandidates({ readme: raw.readmeFull, homepage: raw.meta.homepage, devpostLinks: devpost?.links ?? [] });
    const [snap, demo] = await Promise.all([
      collectSnapshot(
        { repo: `${raw.ref.owner}/${raw.ref.repo}`, tree: raw.headFilePaths, sizes: raw.headFileSizes, readme: raw.readmeFull },
        { read: (p) => readRawAt(raw.ref, raw.latestSha, p), commits: (p) => commitsTouching(raw.ref, p) },
      ),
      checkDemos(demos, (u) => fetchPage(u), raw.ref.repo),
    ]);
    return [...runChecks(snap), ...demo];
  } catch (err) {
    log.warn("scan.checks.failed", { repo: raw.ref.url, error: String(err) });
    return [];
  }
}

/**
 * The whole scan: the model steps and the demo checks in parallel, the first-commit check in
 * code. A demo link the team gave beats the one found in the repo; the found one is still
 * checked and kept (`autoDemo`) so the cached scan works for a session without a link.
 */
export async function scanRepo(
  raw: RawRepoData,
  opts: {
    emit?: Emit;
    demoUrl?: string | null;
    previous?: PreviousRound | null;
    eventContext?: string;
    submission?: SubmissionInput | null;
  } = {},
): Promise<{ scan: Scan; usage: Usage }> {
  const devpost = opts.submission?.devpostUrl ? await fetchDevpost(opts.submission.devpostUrl).catch(() => null) : null;
  const [model, auto, given, checks] = await Promise.all([
    runScanModel(raw, { ...opts, devpost }),
    demoSignal(findDemoUrl(raw), false),
    opts.demoUrl ? demoSignal(opts.demoUrl, true) : Promise.resolve(null),
    deterministicChecks(raw, devpost),
  ]);
  const { firstCommitAddedOver70Pct } = computeSignals(raw, null);
  log.info("scan.validated", { repo: raw.ref.url, claims: model.claims.length, read: model.sources.length });
  return {
    scan: {
      claims: model.claims,
      questions: model.questions,
      signals: { demo: given ?? auto, bulkFirstCommit: firstCommitAddedOver70Pct, commit: raw.latestSha, checks },
      files: raw.headFilePaths.slice(0, STORED_FILES),
      sources: model.sources,
      autoDemo: auto,
    },
    usage: model.usage,
  };
}
