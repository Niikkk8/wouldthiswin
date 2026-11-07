"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "cn";
import { AnimatedBeam, type BeamState } from "@/components/ui/animated-beam";
import { buttonVariants } from "@/components/ui/button";
import { HyperText } from "@/components/ui/hyper-text";
import { JudgeRow, type ReactionCue } from "@/components/judge-portrait";
import { copy, fill } from "@/lib/copy";
import { reactionForDelta } from "@/lib/judge-sprites";
import { EASE } from "@/lib/motion";
import { toneOf, type OddsEvent, type Tone } from "@/lib/odds";
import { progressLine, type ScanProgress } from "@/lib/scan-progress";
import type { Claim, SessionView } from "@/lib/session";
import { ActFooter, ActTitle } from "./act-parts";
import type { Send } from "./session-shell";
import { useReducedMotion } from "@/lib/use-reduced-motion";

// Timing. The whole scan stays under 6 seconds whatever the number of claims.
const ROW_STAGGER_MS = 20;
const SCRAMBLE_MS = 300;
const PLAY_BUDGET_MS = 4800;
const MIN_STEP_MS = 450;
const MAX_STEP_MS = 900;
const DRAW_SHARE = 0.7;
const POLL_MS = 2500;

const BEAM_COLOR = { backed: "#f4f4f2", unclear: "#f5a524", unbacked: "#ff3b30" } as const;
const TONE_TEXT: Record<Tone, string> = {
  gain: "text-gain",
  loss: "text-loss",
  unclear: "text-unclear",
  flat: "text-text-muted",
};

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
const hostOf = (url: string | null) => {
  try {
    return url ? new URL(url).host : "";
  } catch {
    return url ?? "";
  }
};

const desktopQuery = "(min-width: 64rem)";
function useDesktop(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(desktopQuery);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(desktopQuery).matches,
    () => true,
  );
}

// ---------- while the scan runs ----------

type FileState = "reading" | "read" | "skipped";
type Live = { line: string; claims: string[]; files: { path: string; state: FileState }[] };

const LIVE_START: Live = { line: copy.acts.scan.progress.start, claims: [], files: [] };

/** Folds one real server event into what act 1 shows while the scan runs. */
function liveReducer(live: Live, p: ScanProgress): Live {
  const line = progressLine(p);
  switch (p.type) {
    case "claims":
      return { ...live, line, claims: p.claims };
    case "reading":
      return live.files.some((f) => f.path === p.path)
        ? { ...live, line }
        : { ...live, line, files: [...live.files, { path: p.path, state: "reading" }] };
    case "read":
      return {
        ...live,
        // The line follows the newest fetch still running, else this one.
        line: live.files.some((f) => f.state === "reading" && f.path !== p.path) ? live.line : line,
        files: live.files.map((f) => (f.path === p.path ? { ...f, state: p.ok ? "read" : "skipped" } : f)),
      };
    default:
      return { ...live, line };
  }
}

/** The scan as it happens: claims as they're found, files as they're fetched, one live line. */
function LiveScan({ live, repo }: { live: Live; repo: string }) {
  const reduce = useReducedMotion();
  const name = repo.split("/").pop() ?? repo;
  return (
    <>
      <p className="label-mono mt-10 min-h-[1.3em] truncate lg:mt-12" role="status" aria-live="polite">
        <motion.span
          key={live.line}
          className="inline-block"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: EASE }}
        >
          {live.line}
        </motion.span>
      </p>
      <div className="mt-8 grid gap-12 lg:grid-cols-[444px_minmax(0,1fr)] lg:gap-x-[clamp(96px,20vw,294px)]">
        <section aria-labelledby="live-claims" className="pl-6 lg:pl-0">
          <h2 id="live-claims" className="label-mono uppercase">
            {copy.acts.scan.claims}
          </h2>
          <ul className="mt-4 grid gap-6">
            {live.claims.map((c, i) => (
              <motion.li
                key={c + i}
                className="rounded-card border border-border px-5 py-5"
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
                animate={{ opacity: 0.6, y: 0 }}
                transition={{ duration: 0.3, ease: EASE, delay: reduce ? 0 : i * 0.06 }}
              >
                <p className="text-[18px] leading-snug font-bold">{c}</p>
              </motion.li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="live-files" className="pl-6 lg:pl-0">
          <h2 id="live-files" className="label-mono uppercase">
            {copy.acts.scan.files}
          </h2>
          <ul className="mt-4 grid gap-2.5 font-mono text-[15px] lg:text-[16px]">
            <li className="text-text">{name}/</li>
            {live.files.map((f) => (
              <motion.li
                key={f.path}
                className="flex min-w-0 items-baseline gap-3"
                style={{ paddingLeft: 21 }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
              >
                <span
                  className={cn(
                    "min-w-0 truncate transition-colors duration-300",
                    f.state === "reading" && "text-text-subtle",
                    f.state === "read" && "text-text",
                    f.state === "skipped" && "text-text-subtle line-through",
                  )}
                >
                  <span className="sr-only">{f.path}</span>
                  {reduce ? (
                    <span aria-hidden>{f.path}</span>
                  ) : (
                    <HyperText as="span" aria-hidden duration={SCRAMBLE_MS} className="inline-flex">
                      {f.path}
                    </HyperText>
                  )}
                </span>
                <span className="label-mono shrink-0">
                  {f.state === "reading" ? copy.acts.scan.reading : f.state === "skipped" ? copy.acts.scan.skippedTag : ""}
                </span>
              </motion.li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}

// ---------- the X-ray ----------

function ClaimCard({
  claim,
  event,
  resolved,
  dotRef,
}: {
  claim: Claim;
  event: OddsEvent | undefined;
  resolved: boolean;
  dotRef: (el: HTMLSpanElement | null) => void;
}) {
  const tone = event ? toneOf(event) : "flat";
  return (
    <li
      className={cn(
        "relative rounded-card border px-5 py-5 transition-[border-color,background-color,opacity] duration-300",
        !resolved && "border-border opacity-60",
        resolved && claim.status === "backed" && "border-text",
        resolved && claim.status === "unbacked" && "border-loss bg-loss/10",
        resolved && claim.status === "unclear" && "border-dashed border-unclear",
      )}
    >
      <p className="text-[18px] leading-snug font-bold">{claim.claim}</p>
      <p
        className={cn(
          "mt-2 font-mono text-[13px] leading-snug",
          resolved ? (claim.status === "backed" ? "text-text" : TONE_TEXT[tone]) : "invisible",
        )}
      >
        {claim.evidence}
        {event && <span className={cn("ml-3 whitespace-nowrap", TONE_TEXT[tone])}>{signed(event.delta)}</span>}
      </p>
      {/* Where the beam leaves the card: the right edge on desktop, the left on mobile. */}
      <span
        ref={dotRef}
        aria-hidden
        className={cn(
          "absolute top-1/2 -left-[5px] size-[9px] -translate-y-1/2 rounded-full transition-colors duration-300 lg:-right-[5px] lg:left-auto",
          !resolved && "bg-border-strong",
          resolved && claim.status === "backed" && "bg-text",
          resolved && claim.status === "unbacked" && "bg-loss",
          resolved && claim.status === "unclear" && "bg-unclear",
        )}
      />
    </li>
  );
}

function SignalCard({ event, view, resolved }: { event: OddsEvent; view: SessionView; resolved: boolean }) {
  const tone = toneOf(event);
  const demo = view.signals?.demo;
  const title = event.kind === "demo" ? copy.acts.scan.demo : copy.acts.scan.commits;
  const detail =
    event.kind === "demo"
      ? fill(
          demo?.status === "loads"
            ? copy.acts.scan.demoLoads
            : demo?.status === "video"
              ? copy.acts.scan.demoVideo
              : copy.acts.scan.demoDead,
          {
          host: hostOf(demo?.url ?? null),
        })
      : copy.acts.scan.commitsDetail;
  return (
    <li
      className={cn(
        "rounded-card border px-5 py-4 transition-[border-color,opacity] duration-300",
        resolved ? (tone === "gain" ? "border-gain" : "border-loss") : "border-border opacity-60",
      )}
    >
      <p className="text-[16px] font-bold">{title}</p>
      <p className={cn("mt-1.5 font-mono text-[13px]", resolved ? TONE_TEXT[tone] : "invisible")}>
        {detail}
        <span className="ml-3">{signed(event.delta)}</span>
      </p>
    </li>
  );
}

type Hit = "backed" | "unclear" | null;

function FileTree({
  root,
  paths,
  hits,
  fileRef,
}: {
  root: string;
  paths: string[];
  hits: Map<string, Hit>;
  fileRef: (path: string) => (el: HTMLElement | null) => void;
}) {
  const reduce = useReducedMotion();
  return (
    <ul className="mt-4 grid gap-2.5 font-mono text-[15px] lg:text-[16px]">
      <li className="text-text">{root}/</li>
      {paths.map((p, i) => {
        const dir = p.endsWith("/");
        const parts = (dir ? p.slice(0, -1) : p).split("/");
        const name = parts.at(-1)! + (dir ? "/" : "");
        const hit = hits.get(p) ?? null;
        return (
          <motion.li
            key={p}
            style={{ paddingLeft: parts.length * 21 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: reduce ? 0 : (i * ROW_STAGGER_MS) / 1000, duration: 0.2 }}
          >
            <span
              ref={fileRef(p)}
              className={cn(
                "inline-block rounded-[6px] border px-1.5 py-0.5 transition-colors duration-300",
                hit === "backed" && "border-text text-text",
                hit === "unclear" && "border-dashed border-unclear text-unclear",
                !hit && "border-transparent",
                !hit && (dir ? "text-text-muted" : "text-text-subtle"),
              )}
            >
              <span className="sr-only">{name}</span>
              {reduce ? (
                <span aria-hidden>{name}</span>
              ) : (
                <HyperText as="span" aria-hidden delay={i * ROW_STAGGER_MS} duration={SCRAMBLE_MS} className="inline-flex">
                  {name}
                </HyperText>
              )}
            </span>
          </motion.li>
        );
      })}
    </ul>
  );
}

function NotFound({ claim, shown, nodeRef }: { claim: Claim; shown: boolean; nodeRef: (el: HTMLElement | null) => void }) {
  return (
    <motion.div
      ref={nodeRef}
      className="rounded-card border border-dashed border-loss bg-loss/10 px-4 py-3 font-mono text-[13px] leading-relaxed [overflow-wrap:anywhere] lg:w-[288px]"
      initial={false}
      animate={{ opacity: shown ? 1 : 0 }}
      transition={{ duration: 0.3, ease: EASE }}
      aria-hidden={!shown}
    >
      <p className="text-loss">
        {claim.missing ? fill(copy.acts.scan.notFound, { missing: claim.missing }) : copy.acts.scan.notFoundPlain}
      </p>
      {claim.searched.length > 0 && (
        <p className="text-text-subtle">{fill(copy.acts.scan.searched, { paths: claim.searched.join(", ") })}</p>
      )}
    </motion.div>
  );
}

/** Desktop: an S-curve from the card's right edge to the file. Mobile: down a lane in the left gutter. */
function beamPath(from: DOMRect, to: DOMRect, box: DOMRect, desktop: boolean, lane: number): string {
  const sx = from.left + from.width / 2 - box.left;
  const sy = from.top + from.height / 2 - box.top;
  const ex = to.left - box.left - 2;
  const ey = to.top + to.height / 2 - box.top;
  if (desktop) {
    const dx = ex - sx;
    return `M ${sx},${sy} C ${sx + dx * 0.5},${sy} ${ex - dx * 0.5},${ey} ${ex},${ey}`;
  }
  const x = 4 + lane * 3;
  const r = Math.min(6, Math.abs(ey - sy) / 2);
  return `M ${sx},${sy} H ${x + r} Q ${x},${sy} ${x},${sy + r} V ${ey - r} Q ${x},${ey} ${x + r},${ey} H ${ex}`;
}

function XRay({
  view,
  revealed,
  onReveal,
  onNext,
  pending,
}: {
  view: SessionView;
  revealed: number;
  onReveal: (n: number) => void;
  onNext: () => void;
  pending: boolean;
}) {
  const reduce = useReducedMotion();
  const desktop = useDesktop();
  const claims = useMemo(() => view.claims ?? [], [view.claims]);
  const total = view.events.length;
  const done = revealed >= total;
  const step = Math.min(MAX_STEP_MS, Math.max(MIN_STEP_MS, PLAY_BUDGET_MS / Math.max(total, 1)));
  const drawMs = reduce ? 200 : step * DRAW_SHARE;
  const treeMs = reduce ? 0 : Math.min(700, view.tree.length * ROW_STAGGER_MS + SCRAMBLE_MS);

  // Measured geometry for the beams.
  const boxRef = useRef<HTMLDivElement>(null);
  const dots = useRef<(HTMLSpanElement | null)[]>([]);
  const fileEls = useRef(new Map<string, HTMLElement>());
  const missEls = useRef<(HTMLElement | null)[]>([]);
  const [paths, setPaths] = useState<string[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });

  const target = useCallback(
    (i: number): HTMLElement | null =>
      claims[i].status === "unbacked"
        ? (missEls.current[i] ?? null)
        : claims[i].file
          ? (fileEls.current.get(claims[i].file!) ?? null)
          : null,
    [claims],
  );

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const measure = () => {
      const b = box.getBoundingClientRect();
      setSize({ w: b.width, h: b.height });
      setPaths(
        claims.map((_, i) => {
          const from = dots.current[i];
          const to = target(i);
          return from && to ? beamPath(from.getBoundingClientRect(), to.getBoundingClientRect(), b, desktop, i) : "";
        }),
      );
    };
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    document.fonts?.ready.then(measure);
    return () => ro.disconnect();
  }, [claims, desktop, target]);

  // The file tree cascades in first; then claims resolve one at a time.
  const [started, setStarted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setStarted(true), treeMs);
    return () => clearTimeout(t);
  }, [treeMs]);

  const beamFor = (i: number) => i < claims.length && !!paths[i];
  const landed = useRef(-1);
  const advanceFrom = useCallback(
    (k: number) => {
      if (landed.current >= k) return;
      landed.current = k;
      setTimeout(() => onReveal(k + 1), reduce ? 150 : step - drawMs);
    },
    [onReveal, reduce, step, drawMs],
  );

  // Steps without a beam (signals, a claim with nothing to point at) wait out the same beat.
  useEffect(() => {
    if (!started || done || beamFor(revealed)) return;
    const t = setTimeout(() => advanceFrom(revealed), drawMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, done, revealed, paths]);

  const beamState = (i: number): BeamState =>
    i < revealed ? "drawn" : i === revealed && started && !done ? "drawing" : "hidden";

  const hits = new Map<string, Hit>();
  claims.forEach((c, i) => {
    if (i >= revealed || !c.file || c.status === "unbacked") return;
    if (hits.get(c.file) !== "backed") hits.set(c.file, c.status === "backed" ? "backed" : "unclear");
  });

  const signalEvents = view.events.slice(claims.length);
  const name = view.repo.split("/").pop() ?? view.repo;
  const footer = claims.some((c) => c.status === "unbacked" && c.weight === "core")
    ? copy.acts.scan.footer.unbacked
    : claims.some((c) => c.status !== "backed")
      ? copy.acts.scan.footer.unclear
      : copy.acts.scan.footer.clean;

  return (
    <>
      <div
        ref={boxRef}
        className="relative mt-10 grid gap-12 lg:mt-12 lg:grid-cols-[444px_minmax(0,1fr)] lg:gap-x-[clamp(96px,20vw,294px)]"
      >
        <section aria-labelledby="claims-heading" className="pl-6 lg:pl-0">
          <h2 id="claims-heading" className="label-mono uppercase">
            {copy.acts.scan.claims}
          </h2>
          {claims.length === 0 && <p className="mt-4 text-[17px] text-text-muted">{copy.acts.scan.noClaims}</p>}
          <ul className="mt-4 grid gap-6">
            {claims.map((c, i) => (
              <ClaimCard
                key={i}
                claim={c}
                event={view.events[i]}
                resolved={i < revealed}
                dotRef={(el) => {
                  dots.current[i] = el;
                }}
              />
            ))}
          </ul>
          {signalEvents.length > 0 && (
            <ul className="mt-6 grid gap-4">
              {signalEvents.map((e, j) => (
                <SignalCard key={e.kind} event={e} view={view} resolved={claims.length + j < revealed} />
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="files-heading" className="pl-6 lg:pl-0">
          <h2 id="files-heading" className="label-mono uppercase">
            {copy.acts.scan.files}
          </h2>
          <FileTree
            root={name}
            paths={view.tree}
            hits={hits}
            fileRef={(p) => (el) => {
              if (el) fileEls.current.set(p, el);
              else fileEls.current.delete(p);
            }}
          />
          <div className="mt-8 grid gap-4 lg:ml-[170px]">
            {claims.map((c, i) =>
              c.status === "unbacked" ? (
                <NotFound
                  key={i}
                  claim={c}
                  shown={started && i <= revealed}
                  nodeRef={(el) => {
                    missEls.current[i] = el;
                  }}
                />
              ) : null,
            )}
          </div>
        </section>

        <svg
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-visible"
          width={size.w}
          height={size.h}
          viewBox={`0 0 ${size.w} ${size.h}`}
        >
          {claims.map((c, i) =>
            paths[i] ? (
              <AnimatedBeam
                key={`${i}-${desktop}`}
                d={paths[i]}
                color={BEAM_COLOR[c.status]}
                dashed={c.status === "unclear"}
                state={beamState(i)}
                duration={drawMs / 1000}
                onLanded={() => advanceFrom(i)}
              />
            ) : null,
          )}
        </svg>
      </div>

      {!done && (
        <button
          type="button"
          data-demo-hide
          onClick={() => {
            landed.current = total;
            setStarted(true);
            onReveal(total);
          }}
          className="label-mono mt-8 underline underline-offset-4 hover:text-text"
        >
          {copy.acts.scan.skip}
        </button>
      )}
      {done && <ActFooter line={footer} label={copy.acts.scan.next} onClick={onNext} disabled={pending} />}
    </>
  );
}

/** Act 1, the scan. Runs the scan on the server, then plays it: every claim traced to a file. */
export function ScanAct({
  view,
  send,
  revealed,
  onReveal,
  onNext,
  onWaiting,
  pending,
}: {
  view: SessionView;
  send: Send;
  revealed: number;
  onReveal: (n: number) => void;
  onNext: () => void;
  /** True while the scan runs, so the odds widget can pulse at 50%. */
  onWaiting: (waiting: boolean) => void;
  pending: boolean;
}) {
  const scanned = view.claims !== null;
  const [failed, setFailed] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [live, dispatchLive] = useReducer(liveReducer, LIVE_START);
  const asked = useRef(-1);

  useEffect(() => {
    onWaiting(!scanned && !failed);
  }, [scanned, failed, onWaiting]);

  useEffect(() => {
    if (scanned || failed || asked.current === attempt) return;
    asked.current = attempt;
    let retry: ReturnType<typeof setTimeout> | undefined;
    // Progress events are real: each one is a step the server just finished.
    send({ action: "scan" }, { onProgress: dispatchLive }).then((r) => {
      if (r.ok) return;
      if (r.pending) retry = setTimeout(() => setAttempt((n) => n + 1), POLL_MS);
      else if (r.restart) setFailed(r.message ?? copy.errors.judgeFailed);
      else retry = setTimeout(() => setAttempt((n) => n + 1), POLL_MS);
    });
    return () => clearTimeout(retry);
  }, [scanned, failed, attempt, send]);

  // The panel reads along and reacts to each result as it lands.
  const landed = scanned && revealed > 0 ? view.events[Math.min(revealed, view.events.length) - 1] : undefined;
  const kind = landed ? reactionForDelta(landed.delta) : null;
  const cue: ReactionCue | null = kind ? { kind, key: revealed } : null;

  return (
    <>
      <ActTitle eyebrow={copy.acts.scan.eyebrow} title={copy.acts.scan.title} />
      {!failed && (
        <JudgeRow rest="scan" reactions={{ engineer: cue, investor: cue, tired: cue }} className="mt-8 lg:mt-10" />
      )}
      {failed ? (
        <div className="mt-12 max-w-xl">
          <p className="text-[20px] leading-snug" role="alert">
            {failed}
          </p>
          <Link href="/" className={cn(buttonVariants({ variant: "secondary" }), "mt-8")}>
            {copy.acts.scan.restart}
          </Link>
        </div>
      ) : scanned ? (
        <XRay view={view} revealed={revealed} onReveal={onReveal} onNext={onNext} pending={pending} />
      ) : (
        <LiveScan live={live} repo={view.repo} />
      )}
    </>
  );
}
