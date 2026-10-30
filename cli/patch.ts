export type Commit = {
  sha: string;
  repo: string;
  date: string;
  subject: string;
  body: string;
  files: string[];
  newFiles: number;
  added: number;
  removed: number;
  diff: string;
};

const HEADER = /^commit ([0-9a-f]{40})$/;
const DIFF_HEADER = /^diff --git a\/(.+) b\/(.+)$/;

function toCommit(sha: string, repo: string, lines: string[]): Commit {
  const diffStart = lines.findIndex((line) => line.startsWith("diff --git "));
  const head = diffStart === -1 ? lines : lines.slice(0, diffStart);
  const diffLines = diffStart === -1 ? [] : lines.slice(diffStart);

  const date = head.find((line) => line.startsWith("Date: "))?.slice(6) ?? "";
  const subject = head.find((line) => line.startsWith("Subject: "))?.slice(9) ?? "";
  const body = head
    .slice(head.findIndex((line) => line.startsWith("Subject: ")) + 1)
    .join("\n")
    .trim();

  const files: string[] = [];
  let added = 0;
  let removed = 0;
  let newFiles = 0;
  for (const line of diffLines) {
    const match = DIFF_HEADER.exec(line);
    if (match) files.push(match[2]);
    else if (line.startsWith("new file mode")) newFiles += 1;
    else if (line.startsWith("+") && !line.startsWith("+++")) added += 1;
    else if (line.startsWith("-") && !line.startsWith("---")) removed += 1;
  }

  return {
    sha,
    repo,
    date,
    subject,
    body,
    files,
    newFiles,
    added,
    removed,
    diff: diffLines.join("\n"),
  };
}

export function parsePatch(text: string, repo: string): Commit[] {
  const commits: Commit[] = [];
  let sha: string | null = null;
  let lines: string[] = [];

  for (const line of text.split("\n")) {
    const match = HEADER.exec(line);
    if (match) {
      if (sha !== null) commits.push(toCommit(sha, repo, lines));
      sha = match[1];
      lines = [];
    } else if (sha !== null) {
      lines.push(line);
    }
  }
  if (sha !== null) commits.push(toCommit(sha, repo, lines));

  return commits;
}
