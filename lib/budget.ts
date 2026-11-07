// The most one session may spend on the model. A full session peaks around 40k input and
// 4k output tokens; a failed scan or deliberation can be retried, and each retry costs.
// Past this, no more model calls for that session, however often a client retries.

export const SESSION_BUDGET = { input: 150_000, output: 20_000 } as const;

export type Spent = { input: number; output: number };

export const overBudget = (spent: Spent) =>
  spent.input >= SESSION_BUDGET.input || spent.output >= SESSION_BUDGET.output;
