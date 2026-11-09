import { basename } from "node:path";
import { type Commit, fileChurn } from "./patch";

const LOCKFILES = new Set(["bun.lock", "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "go.sum", "Cargo.lock"]);
const NOISE_PATHS = [
  "**/*-lock.*",
  "**/*.lock",
  "**/go.sum",
  "**/vendor/**",
  "**/node_modules/**",
  "**/*.pb.go",
  "**/*.generated.*",
  "**/*.min.*",
  "**/dist/**",
  "**/build/**",
  "**/__snapshots__/**",
  "**/*.png",
  "**/*.jpg",
  "**/*.woff2",
  "**/*.map",
].map((pattern) => new Bun.Glob(pattern));
const ARCH_PATH = /(^|\/)(migrations|api|routes|auth|engine|core|\.github\/workflows)\//;
const TEST_PATH = /(_test\.|\.test\.|\.spec\.|(^|\/)(tests?|__tests__)\/)/;
const DOC_PATH = /\.(md|mdx|txt)$|^docs\//;
const NARRATIVE_VERB = /\b(migrate|race|latency|cache|parser|security)\b/i;
export const REPO_DECAY = 0.55;

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
  if (cleanFiles(commit).length === 0) return "only generated or vendored files";
  if (cleanLines(commit) === 0) return "no substantive changes";
  return null;
}

function isNoise(file: string): boolean {
  return NOISE_PATHS.some((glob) => glob.match(file));
}

function cleanFiles(commit: Commit): string[] {
  return commit.files.filter((file) => !isNoise(file));
}

function cleanLines(commit: Commit): number {
  const noise = fileChurn(commit.diff)
    .filter((entry) => isNoise(entry.file))
    .reduce((sum, entry) => sum + entry.added + entry.removed, 0);
  return Math.max(0, commit.added + commit.removed - noise);
}

export function effortScore(lines: number): number {
  if (lines < 10) return 0.2;
  if (lines < 30) return 0.2 + (0.6 * (lines - 10)) / 20;
  if (lines <= 600) return 1;
  if (lines <= 2500) return 1 - (0.5 * (lines - 600)) / 1900;
  return 0.35;
}

function archScore(files: string[]): number {
  if (files.some((file) => ARCH_PATH.test(file))) return 1;
  if (files.every((file) => DOC_PATH.test(file) || TEST_PATH.test(file))) return 0.2;
  return 0.6;
}

function narrativeScore(commit: Commit): number {
  const words = commit.subject.trim().split(/\s+/).length;
  let value = 0.2;
  if (commit.body.includes("\n")) value += 0.5;
  if (NARRATIVE_VERB.test(`${commit.subject} ${commit.body}`)) value += 0.3;
  if (words === 1) value -= 0.4;
  return Math.min(1, Math.max(0, value));
}

function scopeScore(files: string[]): number {
  const modules = new Set(files.map((file) => file.split("/")[0]));
  const mixed = files.some((file) => TEST_PATH.test(file)) && files.some((file) => !TEST_PATH.test(file));
  return Math.min(1, Math.min(modules.size, 4) / 4 + (mixed ? 0.15 : 0));
}

export function score(commit: Commit): number {
  const files = cleanFiles(commit);
  const value =
    0.35 * archScore(files) +
    0.25 * effortScore(cleanLines(commit)) +
    0.2 * narrativeScore(commit) +
    0.2 * scopeScore(files);
  return Number(value.toFixed(3));
}

export function decayByRepo<T extends Commit & { score: number }>(candidates: T[]): T[] {
  const pool = [...candidates];
  const picks = new Map<string, number>();
  const ordered: T[] = [];
  const weight = (item: T) => item.score * REPO_DECAY ** (picks.get(item.repo) ?? 0);
  while (pool.length > 0) {
    let best = 0;
    for (let index = 1; index < pool.length; index += 1) {
      if (weight(pool[index]) > weight(pool[best])) best = index;
    }
    const [next] = pool.splice(best, 1);
    ordered.push(next);
    picks.set(next.repo, (picks.get(next.repo) ?? 0) + 1);
  }
  return ordered;
}

function areaOf(file: string): string {
  const parts = file.split("/");
  return parts.length === 1 ? file : parts.slice(0, Math.min(parts.length - 1, 2)).join("/");
}

export function topicKey(repo: string, files: string[]): string {
  const counts = new Map<string, number>();
  for (const file of files) {
    const area = areaOf(file);
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
