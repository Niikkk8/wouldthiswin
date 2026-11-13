// Every deterministic check, in one place. Pure: same snapshot, same findings.

import type { Finding } from "../findings";
import { hygiene } from "./hygiene";
import { readmeEssentials } from "./readme";
import { secretsInHistory, secretsInTree } from "./secrets";
import { setupReproducibility } from "./setup";
import { templateLeftovers } from "./template";
import type { RepoSnapshot } from "./types";

export const CHECKS = {
  secrets: secretsInTree,
  history: secretsInHistory,
  template: templateLeftovers,
  setup: setupReproducibility,
  readme: readmeEssentials,
  hygiene,
} as const;

export type CheckName = keyof typeof CHECKS;

export function runChecks(s: RepoSnapshot, only: readonly CheckName[] = Object.keys(CHECKS) as CheckName[]): Finding[] {
  return only.flatMap((name) => CHECKS[name](s));
}
