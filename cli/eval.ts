import { buildPrompt, check, chooseMode, type Mode, parseDraft } from "./draft";
import type { Commit } from "./patch";
import { score } from "./select";

export type EvalCase = {
  name: string;
  expectMode: Mode;
  notes: string;
  commits: Commit[];
};

export type CaseResult = {
  name: string;
  expectMode: Mode;
  mode: Mode;
  modeMatch: boolean;
  parsed: boolean;
  produced: number;
  kept: number;
  error: string | null;
};

export type Summary = {
  cases: number;
  modeMatchRate: number;
  parseRate: number;
  validationPassRate: number;
};

export async function evaluateCase(
  evalCase: EvalCase,
  minStoryScore: number,
  voice: string,
  run: (prompt: string) => Promise<string>,
): Promise<CaseResult> {
  const mode = chooseMode(Math.max(...evalCase.commits.map(score)), minStoryScore);
  const base = {
    name: evalCase.name,
    expectMode: evalCase.expectMode,
    mode,
    modeMatch: mode === evalCase.expectMode,
    kept: 0,
    produced: 0,
  };

  let raw: string;
  try {
    raw = await run(buildPrompt(evalCase.commits, mode, voice));
  } catch (error) {
    return { ...base, parsed: false, error: `agent call failed: ${(error as Error).message}` };
  }

  let draft;
  try {
    draft = parseDraft(raw);
  } catch (error) {
    return { ...base, parsed: false, error: `unreadable output: ${(error as Error).message}` };
  }

  const produced = draft.tweets.length + (draft.blog ? 1 : 0);
  const checked = check(mode === "theme" ? { ...draft, tweets: [] } : draft, evalCase.commits);
  const kept = checked.draft.tweets.length + (checked.draft.blog ? 1 : 0);
  return { ...base, parsed: true, produced, kept, error: null };
}

function ratio(part: number, whole: number): number {
  return whole === 0 ? 0 : Number((part / whole).toFixed(3));
}

export function summarize(results: CaseResult[]): Summary {
  const produced = results.reduce((sum, result) => sum + result.produced, 0);
  const kept = results.reduce((sum, result) => sum + result.kept, 0);
  return {
    cases: results.length,
    modeMatchRate: ratio(results.filter((result) => result.modeMatch).length, results.length),
    parseRate: ratio(results.filter((result) => result.parsed).length, results.length),
    validationPassRate: ratio(kept, produced),
  };
}
