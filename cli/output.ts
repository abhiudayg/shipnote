import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type Checked, type Mode, RUBRIC } from "./draft";
import type { Commit } from "./patch";
import { commitUrl, LINKEDIN_MAX_CHARS, linkedinPost } from "./platforms";

export type RunMeta = {
  model: string;
  effort: string;
  promptSha256: string;
  configSha256: string;
  durationMs: number;
  estimatedTokens: number;
  estimatedCostUsd: number;
};

export type RunInfo = {
  date: string;
  mode: Mode;
  selected: number;
  skipped: number;
  usage?: string;
  voice?: string;
  meta: RunMeta;
};

const GENERATED = ["review.md", "tweets.md", "blog.md", "sources.json", "linkedin.md", "meta.json"];

function tweetsMarkdown(result: Checked, commits: Commit[], date: string): string {
  const byHash = new Map(commits.map((c) => [c.sha, c]));
  const sections = result.draft.tweets.map((tweet, index) => {
    const sources = tweet.shas.map((sha) => {
      const commit = byHash.get(sha);
      return commit ? `- ${sha.slice(0, 7)} ${commit.repo}: ${commitUrl(commit.repo, sha)}` : `- ${sha}`;
    });
    return [`## Tweet ${index + 1}`, "", tweet.text, "", "Sources:", ...sources].join("\n");
  });
  const body = sections.length > 0 ? sections.join("\n\n") : "No tweet passed validation.";
  return `# Tweets for ${date}\n\n${body}\n`;
}

function blogMarkdown(result: Checked, date: string, mode: Mode): string {
  const blog = result.draft.blog;
  if (!blog) return `# Blog for ${date}\n\nNo blog post passed validation. See review.md.\n`;
  const shas = blog.shas.map((sha) => `  - ${sha}`).join("\n");
  return [
    "---",
    `title: ${JSON.stringify(blog.title)}`,
    `date: ${date}`,
    `mode: ${mode}`,
    "shas:",
    shas,
    "---",
    "",
    blog.summary,
    "",
    blog.body,
    "",
  ].join("\n");
}

function sourcesJson(result: Checked, commits: Commit[], date: string): string {
  const byHash = new Map(commits.map((c) => [c.sha, c]));
  const describe = (shas: string[]) =>
    shas.map((sha) => {
      const commit = byHash.get(sha);
      return { sha, repo: commit?.repo ?? null, subject: commit?.subject ?? null, files: commit?.files ?? [] };
    });
  const claims = [
    ...result.draft.tweets.map((tweet, index) => ({ item: `tweet ${index + 1}`, text: tweet.text, commits: describe(tweet.shas) })),
    ...(result.draft.blog
      ? [{ item: "blog", text: `${result.draft.blog.title}. ${result.draft.blog.summary}`, commits: describe(result.draft.blog.shas) }]
      : []),
  ];
  return `${JSON.stringify({ date, claims }, null, 2)}\n`;
}

function headerLines(date: string, meta: RunMeta): string[] {
  return [
    `# Review for ${date}`,
    "",
    `- Model: ${meta.model} (effort ${meta.effort})`,
    `- Prompt: ${meta.promptSha256.slice(0, 12)}; config: ${meta.configSha256.slice(0, 12)}`,
    `- Time: ${(meta.durationMs / 1000).toFixed(1)}s`,
  ];
}

function reviewMarkdown(result: Checked, linkedin: string | null, info: RunInfo): string {
  const lines = [
    ...headerLines(info.date, info.meta),
    `- Commits selected: ${info.selected}; skipped: ${info.skipped}`,
    `- Mode: ${info.mode}`,
  ];
  if (info.usage) lines.push(`- Usage: ${info.usage}`);
  if (info.voice) lines.push(`- Voice: ${info.voice}`);
  if (linkedin) lines.push(`- LinkedIn: ${linkedin.length}/${LINKEDIN_MAX_CHARS} characters`);
  lines.push(`- Kept: ${result.draft.tweets.length} tweet(s), blog ${result.draft.blog ? "yes" : "no"}`, "", "## Rejected", "");
  lines.push(result.rejections.length > 0 ? result.rejections.map((r) => `- ${r.item}: ${r.reason}`).join("\n") : "None.");
  return `${lines.join("\n")}\n`;
}

function metaJson(meta: RunMeta, kept: number): string {
  const costPerKept = kept === 0 ? null : Number((meta.estimatedCostUsd / kept).toFixed(6));
  return `${JSON.stringify({ ...meta, rubric: RUBRIC, kept, costPerKeptUsd: costPerKept }, null, 2)}\n`;
}

function clearGenerated(dir: string): void {
  mkdirSync(dir, { recursive: true });
  for (const file of GENERATED) rmSync(join(dir, file), { force: true });
}

export function writeFailure(dir: string, date: string, error: string, meta: RunMeta): void {
  mkdirSync(dir, { recursive: true });
  const lines = [
    ...headerLines(date, meta),
    "",
    "## Failure",
    "",
    error,
    "",
    "No drafts were written. Files from an earlier run, and approvals, were kept.",
  ];
  writeFileSync(join(dir, "review.md"), `${lines.join("\n")}\n`);
}

export function writeDrafts(dir: string, result: Checked, commits: Commit[], info: RunInfo): void {
  clearGenerated(dir);
  const linkedin = linkedinPost(result, commits);
  const kept = result.draft.tweets.length + (result.draft.blog ? 1 : 0);
  writeFileSync(join(dir, "review.md"), reviewMarkdown(result, linkedin, info));
  writeFileSync(join(dir, "tweets.md"), tweetsMarkdown(result, commits, info.date));
  writeFileSync(join(dir, "blog.md"), blogMarkdown(result, info.date, info.mode));
  writeFileSync(join(dir, "sources.json"), sourcesJson(result, commits, info.date));
  if (linkedin) writeFileSync(join(dir, "linkedin.md"), `${linkedin}\n`);
  writeFileSync(join(dir, "meta.json"), metaJson(info.meta, kept));
}
