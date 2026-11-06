import { cacheLife } from "next/cache";
import { db } from "./db";
import type { Judgment } from "./judge";
import type { Signals } from "./signals";

export type StoredJudgment = {
  id: string;
  repoUrl: string;
  demoUrl: string;
  signals: Signals;
  result: Judgment;
  createdAt: string;
};

const ID_RE = /^[a-z0-9]{10}$/;

/** A finished judgment never changes, so it is cached indefinitely. */
export async function getJudgment(id: string): Promise<StoredJudgment | null> {
  "use cache";
  cacheLife("max");

  if (!ID_RE.test(id)) return null;
  const { data, error } = await db()
    .from("judgments")
    .select("id, repo_url, demo_url, signals, result, created_at")
    .eq("id", id)
    .eq("status", "done")
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    repoUrl: data.repo_url,
    demoUrl: data.demo_url,
    signals: data.signals,
    result: data.result,
    createdAt: data.created_at,
  };
}

export const repoName = (repoUrl: string) => repoUrl.replace(/^https:\/\/github\.com\//, "");
