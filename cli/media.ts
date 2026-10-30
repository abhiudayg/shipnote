import { SECRET } from "./draft";
import type { Commit } from "./patch";

export const TWEET_SIZE = { width: 1200, height: 675 };
export const BLOG_SIZE = { width: 1600, height: 900 };

export type Excerpt = { file: string; lines: string[] };

export type MediaItem = {
  file: string;
  alt: string;
  sha: string;
  repo: string;
  width: number;
  height: number;
};

function changedRuns(diff: string): Array<{ file: string; lines: string[] }> {
  const runs: Array<{ file: string; lines: string[] }> = [];
  let file = "";
  let current: string[] = [];
  const flush = () => {
    if (current.length > 0) runs.push({ file, lines: current });
    current = [];
  };
  for (const line of diff.split("\n")) {
    const header = /^diff --git a\/.+ b\/(.+)$/.exec(line);
    if (header) {
      flush();
      file = header[1];
      continue;
    }
    const changed = (line.startsWith("+") && !line.startsWith("+++")) || (line.startsWith("-") && !line.startsWith("---"));
    if (changed) current.push(line);
    else flush();
  }
  flush();
  return runs;
}

export function firstExcerpt(commit: Commit, maxLines = 8): Excerpt | null {
  const run = changedRuns(commit.diff).find((candidate) => candidate.lines.length >= 2);
  if (!run) return null;
  const lines = run.lines.slice(0, maxLines);
  if (lines.some((line) => SECRET.test(line))) return null;
  return { file: run.file, lines };
}

export function excerptMatchesDiff(excerpt: Excerpt, diff: string): boolean {
  const diffLines = new Set(diff.split("\n"));
  return excerpt.lines.every((line) => diffLines.has(line));
}

function escapeXml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function excerptCard(excerpt: Excerpt, commit: Commit, size: { width: number; height: number }): string {
  const lineHeight = 44;
  const top = 200;
  const rows = excerpt.lines.map((line, index) => {
    const y = top + index * lineHeight;
    const added = line.startsWith("+");
    const fill = added ? "#052e16" : "#2a0a0a";
    const ink = added ? "#86efac" : "#fca5a5";
    return `<rect x="60" y="${y - 32}" width="${size.width - 120}" height="${lineHeight}" fill="${fill}"/><text x="84" y="${y}" font-family="JetBrains Mono, Menlo, monospace" font-size="26" fill="${ink}">${escapeXml(line)}</text>`;
  });
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}" viewBox="0 0 ${size.width} ${size.height}">`,
    `<rect width="${size.width}" height="${size.height}" fill="#000000"/>`,
    `<text x="60" y="90" font-family="Geist, Inter, sans-serif" font-size="40" font-weight="600" fill="#ffffff">${escapeXml(excerpt.file)}</text>`,
    `<text x="60" y="140" font-family="JetBrains Mono, Menlo, monospace" font-size="24" fill="#a1a1aa">${escapeXml(commit.repo)} · ${commit.sha.slice(0, 7)}</text>`,
    ...rows,
    `</svg>`,
    "",
  ].join("\n");
}

export function altText(excerpt: Excerpt, commit: Commit): string {
  return `Diff excerpt from ${excerpt.file} in commit ${commit.sha.slice(0, 7)} (${commit.repo}), showing ${excerpt.lines.length} changed lines.`;
}
