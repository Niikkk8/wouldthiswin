// An eval fixture: a small synthetic repo, the claims an extraction would pull from it, and
// which checks should fire. Files are TypeScript so secret-shaped strings can be assembled at
// runtime and nothing secret-like is ever committed.

import type { Claim } from "../../lib/session";

export type Fixture = {
  name: string;
  readme: string;
  files: Record<string, string>;
  sizes?: Record<string, number>;
  /** What a claim extraction would find; drives the AI-depth check without a model call. */
  claims: Claim[];
  /** The checks expected to report a problem. Every other check should stay quiet. */
  expected: string[];
};

export const claim = (text: string, category: Claim["category"] = "feature"): Claim => ({
  claim: text,
  status: "unclear",
  weight: "core",
  file: null,
  evidence: "",
  label: "",
  missing: null,
  searched: [],
  category,
});
