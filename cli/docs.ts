import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

export const DOCS_PREFIX = "docs/";

function documentEntry(repo: string, file: string, text: string): string {
  const sha = createHash("sha1").update(`${repo}/${file}`).digest("hex");
  const subject = text.match(/^# (.+)$/m)?.[1] ?? file;
  const lines = text.split("\n");
  return [
    `commit ${sha}`,
    `Subject: ${subject}`,
    `diff --git a/${file} b/${file}`,
    "new file mode 100644",
    `@@ -0,0 +1,${lines.length} @@`,
    ...lines.map((line) => `+${line}`),
  ].join("\n");
}

export function importDocs(source: string, destination: string): string[] {
  const repo = `${DOCS_PREFIX}${basename(resolve(source))}`;
  const files = [...new Bun.Glob("**/*.md").scanSync(source)].sort();
  if (files.length === 0) throw new Error(`no .md files found under ${source}`);
  const target = join(destination, "docs", `${basename(repo)}.patch`);
  mkdirSync(dirname(target), { recursive: true });
  const entries = files.map((file) => documentEntry(repo, file, readFileSync(join(source, file), "utf8")));
  writeFileSync(target, `${entries.join("\n")}\n`);
  return files;
}
