import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Checked, Mode } from "./draft";
import type { Commit } from "./patch";

export type RunInfo = {
  date: string;
  mode: Mode;
  model: string;
  effort: string;
  selected: number;
  skipped: number;
  usage?: string;
  error?: string;
};

function commitUrl(repo: string, sha: string): string {
  return `https://github.com/${repo}/commit/${sha}`;
}

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
      ? [{ item: "blog", text: result.draft.blog.title, commits: describe(result.draft.blog.shas) }]
      : []),
  ];
  return `${JSON.stringify({ date, claims }, null, 2)}\n`;
}

function reviewMarkdown(result: Checked | null, info: RunInfo): string {
  const lines = [
    `# Review for ${info.date}`,
    "",
    `- Model: ${info.model} (effort ${info.effort})`,
    `- Commits selected: ${info.selected}; skipped: ${info.skipped}`,
    `- Mode: ${info.mode}`,
  ];
  if (info.usage) lines.push(`- Usage: ${info.usage}`);
  if (info.error) {
    lines.push("", "## Failure", "", info.error, "", "No drafts were written.");
    return `${lines.join("\n")}\n`;
  }
  const kept = result ? `${result.draft.tweets.length} tweet(s), blog ${result.draft.blog ? "yes" : "no"}` : "";
  lines.push(`- Kept: ${kept}`, "", "## Rejected", "");
  const rejections = result?.rejections ?? [];
  lines.push(rejections.length > 0 ? rejections.map((r) => `- ${r.item}: ${r.reason}`).join("\n") : "None.");
  return `${lines.join("\n")}\n`;
}

export function writeDrafts(dir: string, result: Checked | null, commits: Commit[], info: RunInfo): void {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "review.md"), reviewMarkdown(result, info));
  if (!result) return;
  writeFileSync(join(dir, "tweets.md"), tweetsMarkdown(result, commits, info.date));
  writeFileSync(join(dir, "blog.md"), blogMarkdown(result, info.date, info.mode));
  writeFileSync(join(dir, "sources.json"), sourcesJson(result, commits, info.date));
}
