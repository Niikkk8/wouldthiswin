// F15: how deep the AI really goes, from dependencies, imports and call sites: none, one API
// call wrapped, a prompt chain, RAG, agents with tools, a fine-tuned model, or a model trained
// here. Then the claims that say more than that, which give the Engineer a question.

import { copy, fill } from "../copy";
import type { Evidence, Finding } from "../findings";
import type { Claim } from "../session";
import type { RepoSnapshot } from "./types";

export const AI_LEVELS = ["none", "wrapper", "chain", "rag", "agents", "fine_tuned", "custom_trained"] as const;
export type AiLevel = (typeof AI_LEVELS)[number];

type Signal = { level: AiLevel; re: RegExp };

// Line-level signals, strongest first within each level. Matching any line of code is
// evidence; nothing here is a guess from the README.
const SIGNALS: Signal[] = [
  { level: "custom_trained", re: /\b(model\.fit\(|trainer\.train\(|optimizer\.step\(\)|loss\.backward\(\)|torch\.save\(|keras\.models\.Sequential\(|nn\.Module\b)/ },
  { level: "fine_tuned", re: /\b(fine_tuning\.jobs\.create|FineTuningJob|peft\b|LoraConfig\(|SFTTrainer\(|["']ft:[\w-]+:)/ },
  { level: "agents", re: /\b(tool_choice|tools\s*:\s*\[|function_call|AgentExecutor|create_react_agent|createReactAgent|langgraph|crewai|autogen|@tool\b|betaZodTool|tool_runner|toolRunner)/i },
  { level: "rag", re: /\b(embeddings?\.create|createEmbedding|OpenAIEmbeddings|embed_documents|embedQuery|similarity_search|pinecone|chromadb|weaviate|qdrant|pgvector|faiss|vectorstore|VectorStore)/i },
  { level: "chain", re: /\b(LLMChain|RunnableSequence|\.pipe\(\s*(prompt|llm|model)|SequentialChain|ChatPromptTemplate)/ },
  { level: "wrapper", re: /\b(chat\.completions\.create|messages\.create|generateContent|generateText|streamText|completions\.create|ChatOpenAI\(|ChatAnthropic\(|InferenceClient|pipeline\(\s*["'](text|sentiment|summari|translation|question))/ },
];

/** Loading a published model counts as using one, not as training one. */
const PRETRAINED = /\bfrom_pretrained\(|hf_hub_download|AutoModel|pipeline\(/;

export type AiDepth = { level: AiLevel; evidence: Evidence[] };

/** The deepest level the code shows, with up to three lines that show it. */
export function aiDepth(s: Pick<RepoSnapshot, "files">): AiDepth {
  const found = new Map<AiLevel, Evidence[]>();
  for (const [path, text] of s.files) {
    if (!/\.(m?[jt]sx?|py|ipynb)$/.test(path)) continue;
    text.split(/\r?\n/).forEach((line, i) => {
      for (const sig of SIGNALS) {
        if (!sig.re.test(line)) continue;
        const list = found.get(sig.level) ?? [];
        if (list.length < 3) list.push({ kind: "file", path, startLine: i + 1, endLine: i + 1 });
        found.set(sig.level, list);
      }
    });
  }
  const level = [...AI_LEVELS].reverse().find((l) => found.has(l)) ?? "none";
  return { level, evidence: found.get(level) ?? [] };
}

export const usesPretrained = (s: Pick<RepoSnapshot, "files">) => [...s.files.values()].some((t) => PRETRAINED.test(t));

/** What an AI claim says about depth: a model of their own, a fine-tune, or RAG or agents. */
function claimedLevel(text: string): AiLevel | null {
  if (/\b(custom|own|proprietary|in-house|novel|trained (our|a|the)|built (our|a) (ml |ai )?model|deep learning model)\b/i.test(text)) return "custom_trained";
  if (/\bfine[- ]?tun/i.test(text)) return "fine_tuned";
  if (/\b(agent|agentic|autonomous|tool use)\b/i.test(text)) return "agents";
  if (/\b(rag|retrieval|vector (db|database|search|store)|embeddings?)\b/i.test(text)) return "rag";
  return null;
}

const A = copy.checks.ai;

export function aiDepthFindings(depth: AiDepth, claims: readonly Claim[], pretrained: boolean): Finding[] {
  const out: Finding[] = [];
  if (depth.level !== "none") {
    out.push({
      id: "ai-depth",
      check: "ai",
      outcome: "pass",
      severity: null,
      title: fill(A.level, { level: A.levels[depth.level] }),
      detail: A.levelDetail,
      evidence: depth.evidence,
      fix: null,
      effort: null,
      visibility: "public",
    });
  }
  claims.forEach((c, i) => {
    if (c.category && c.category !== "ai") return;
    const claimed = claimedLevel(c.claim);
    if (!claimed || AI_LEVELS.indexOf(claimed) <= AI_LEVELS.indexOf(depth.level)) return;
    const found = depth.level === "none" ? A.foundNone : pretrained && claimed === "custom_trained" ? A.foundPretrained : A.levels[depth.level];
    out.push({
      id: `ai-overstated-${i + 1}`,
      check: "ai",
      outcome: "fail",
      severity: c.weight === "core" ? "major" : "minor",
      title: fill(A.overstated, { claim: c.claim }),
      detail: fill(A.overstatedDetail, { claimed: A.levels[claimed], found }),
      evidence: depth.evidence.length ? depth.evidence : [{ kind: "check", detail: A.noAiCode }],
      fix: fill(A.fix, { found }),
      effort: "5m",
      visibility: "public",
    });
  });
  return out;
}
