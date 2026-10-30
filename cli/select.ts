import { basename } from "node:path";
import type { Commit } from "./patch";

const LOCKFILES = new Set(["bun.lock", "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "go.sum", "Cargo.lock"]);
const WEAK_SUBJECT = /^(wip|fix|update|misc|tmp|temp)\b/i;

export type Skip = { sha: string; reason: string };

export type Selection = {
  selected: Array<Commit & { score: number }>;
  skipped: Skip[];
};

export function skipReason(commit: Commit, used: Set<string>, denylist: Set<string>): string | null {
  if (used.has(commit.sha)) return "already used";
  if (denylist.has(commit.repo)) return "denylisted repo";
  if (commit.subject.startsWith("Merge ")) return "merge commit";
  if (commit.files.length === 0) return "no file changes";
  if (commit.files.every((file) => LOCKFILES.has(basename(file)))) return "lockfile only";
  return null;
}

export function score(commit: Commit): number {
  const size = Math.min(1, Math.log10(1 + commit.added + commit.removed) / Math.log10(1 + 50000));
  const newFiles = Math.min(1, commit.newFiles / 5);
  const quality = commit.subject.length >= 15 && !WEAK_SUBJECT.test(commit.subject) ? 1 : 0;
  return Number((0.6 * size + 0.2 * newFiles + 0.2 * quality).toFixed(3));
}

export function select(commits: Commit[], used: Set<string>, denylist: Set<string>): Selection {
  const selected: Selection["selected"] = [];
  const skipped: Skip[] = [];

  for (const commit of commits) {
    const reason = skipReason(commit, used, denylist);
    if (reason) skipped.push({ sha: commit.sha, reason });
    else selected.push({ ...commit, score: score(commit) });
  }

  selected.sort((a, b) => b.score - a.score);
  return { selected, skipped };
}
