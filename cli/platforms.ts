import type { Checked } from "./draft";
import { DOCS_PREFIX } from "./docs";
import type { Commit } from "./patch";

export const LINKEDIN_MAX_CHARS = 3000;

export function commitUrl(repo: string, sha: string): string | null {
  if (repo.startsWith(DOCS_PREFIX)) return null;
  return `https://github.com/${repo}/commit/${sha}`;
}

export function linkedinPost(result: Checked, commits: Commit[]): string | null {
  const blog = result.draft.blog;
  const tweet = result.draft.tweets[0];
  const source = blog ?? tweet;
  if (!source) return null;
  const text = blog ? `${blog.title}\n\n${blog.summary}` : tweet.text;
  const byHash = new Map(commits.map((c) => [c.sha, c]));
  const links = [...new Set(source.shas)].flatMap((sha) => {
    const commit = byHash.get(sha);
    const url = commit && commitUrl(commit.repo, sha);
    return url ? [url] : [];
  });
  return [text, "", ...links].join("\n");
}
