import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { BLOG_SIZE, excerptCard, excerptMatchesDiff, firstExcerpt, TWEET_SIZE } from "./media";
import { parsePatch, type Commit } from "./patch";

const sample = parsePatch(readFileSync(new URL("./fixtures/sample.patch", import.meta.url), "utf8"), "abhiudayg/dustmap");
const retry = sample[0];

function withDiff(diff: string): Commit {
  return { ...retry, diff };
}

describe("firstExcerpt", () => {
  test("takes the first run of changed lines with its file", () => {
    const excerpt = firstExcerpt(retry);
    expect(excerpt?.file).toBe("scripts/retry.sh");
    expect(excerpt?.lines).toEqual([
      "+#!/usr/bin/env bash",
      "+retry() {",
      '+  for i in 1 2 3; do "$@" && return 0; done',
      "+}",
    ]);
  });

  test("returns null when no run has two changed lines", () => {
    expect(firstExcerpt(withDiff("diff --git a/x b/x\n@@ -1,2 +1,2 @@\n kept\n+new\n kept again\n"))).toBeNull();
  });

  test("refuses an excerpt that matches a secret pattern", () => {
    const diff = "diff --git a/.env b/.env\n+TOKEN=ghp_abcdefghijklmnopqrstuvwxyz\n+OTHER=1\n";
    expect(firstExcerpt(withDiff(diff))).toBeNull();
  });
});

describe("excerptMatchesDiff", () => {
  test("accepts an excerpt whose lines all appear in the diff", () => {
    const excerpt = firstExcerpt(retry);
    expect(excerpt).not.toBeNull();
    expect(excerptMatchesDiff(excerpt!, retry.diff)).toBe(true);
  });

  test("rejects an excerpt with a line the diff does not contain", () => {
    expect(excerptMatchesDiff({ file: "scripts/retry.sh", lines: ["+invented line"] }, retry.diff)).toBe(false);
  });
});

describe("excerptCard", () => {
  test("renders an SVG at the requested size with escaped text", () => {
    const excerpt = { file: "a&b.ts", lines: ['+const x = "<y>";', "+ok()"] };
    const svg = excerptCard(excerpt, retry, TWEET_SIZE);
    expect(svg).toContain('width="1200" height="675"');
    expect(svg).toContain("a&amp;b.ts");
    expect(svg).toContain("&lt;y&gt;");
    expect(svg).not.toContain("<y>");
  });

  test("uses the blog hero size", () => {
    expect(excerptCard({ file: "f", lines: ["+a", "+b"] }, retry, BLOG_SIZE)).toContain('width="1600" height="900"');
  });
});
