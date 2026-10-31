import { basename } from "node:path";
import type { Commit } from "./patch";

const LOCKFILES = new Set(["bun.lock", "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "go.sum", "Cargo.lock"]);
const WEAK_SUBJECT = /^(wip|fix|update|misc|tmp|temp)\b/i;

export type Skip = { sha: string; reason: string };

export type Rules = {
  used: Set<string>;
  denylistRepos: Set<string>;
  denylistTerms: string[];
};

export type Selection = {
  selected: Array<Commit & { score: number }>;
  skipped: Skip[];
};

export function skipReason(commit: Commit, rules: Rules): string | null {
  if (rules.used.has(commit.sha)) return "already used";
  if (rules.denylistRepos.has(commit.repo)) return "denylisted repo";
  const text = `${commit.subject}\n${commit.body}`.toLowerCase();
  if (rules.denylistTerms.some((term) => text.includes(term.toLowerCase()))) return "denylisted term";
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

export function topicKey(repo: string, files: string[]): string {
  const counts = new Map<string, number>();
  for (const file of files) {
    const area = file.split("/")[0];
    counts.set(area, (counts.get(area) ?? 0) + 1);
  }
  const [area] = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] ?? [""];
  return `${repo}/${area}`;
}

export function topicOf(commit: Commit): string {
  return topicKey(commit.repo, commit.files);
}

export function representatives<T extends Commit>(ranked: T[]): T[] {
  const seen = new Set<string>();
  return ranked.filter((commit) => {
    const topic = topicOf(commit);
    if (seen.has(topic)) return false;
    seen.add(topic);
    return true;
  });
}

export function select(commits: Commit[], rules: Rules): Selection {
  const selected: Selection["selected"] = [];
  const skipped: Skip[] = [];

  for (const commit of commits) {
    const reason = skipReason(commit, rules);
    if (reason) skipped.push({ sha: commit.sha, reason });
    else selected.push({ ...commit, score: score(commit) });
  }

  selected.sort((a, b) => b.score - a.score);
  return { selected, skipped };
}
