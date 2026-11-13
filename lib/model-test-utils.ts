// Test helper: a usage total without its per-call breakdown.

import type { Usage } from "./model";

export const tokens = (u: Usage) => ({ inputTokens: u.inputTokens, outputTokens: u.outputTokens });
