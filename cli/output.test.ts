import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Checked } from "./draft";
import { writeDrafts, writeFailure, type RunMeta } from "./output";
import { parsePatch } from "./patch";

const commits = parsePatch(readFileSync(new URL("./fixtures/sample.patch", import.meta.url), "utf8"), "abhiudayg/dustmap");
const retrySha = "1111111111111111111111111111111111111111";
const meta: RunMeta = {
  model: "test-model",
  effort: "low",
  promptSha256: "a".repeat(64),
  configSha256: "b".repeat(64),
  durationMs: 1500,
  estimatedTokens: 1000,
  estimatedCostUsd: 0.5,
};

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "shipnote-output-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("writeFailure", () => {
  test("writes the reason and the prompt and config versions to the review", () => {
    writeFailure(dir, "2026-10-31", "The agent call failed: timed out", meta);
    const review = readFileSync(join(dir, "review.md"), "utf8");
    expect(review).toContain("The agent call failed: timed out");
    expect(review).toContain(`Prompt: ${"a".repeat(12)}; config: ${"b".repeat(12)}`);
  });

  test("keeps the files and approvals of an earlier run", () => {
    writeFileSync(join(dir, "approved.json"), '["tweet-1"]\n');
    writeFileSync(join(dir, "sources.json"), '{"claims":[]}\n');
    writeFailure(dir, "2026-10-31", "failed", meta);
    expect(readFileSync(join(dir, "approved.json"), "utf8")).toBe('["tweet-1"]\n');
    expect(readFileSync(join(dir, "sources.json"), "utf8")).toBe('{"claims":[]}\n');
  });

  test("leaves the metadata of the last successful run in place", () => {
    writeFileSync(join(dir, "meta.json"), '{"kept":1}\n');
    writeFailure(dir, "2026-10-31", "failed", meta);
    expect(readFileSync(join(dir, "meta.json"), "utf8")).toBe('{"kept":1}\n');
  });
});

describe("writeDrafts", () => {
  const result: Checked = { draft: { tweets: [{ text: "Retries now run.", shas: [retrySha] }], blog: null }, rejections: [] };

  test("writes the platform files and the run metadata", () => {
    writeDrafts(dir, result, commits, { date: "2026-10-31", mode: "story", selected: 1, skipped: 0, meta });
    expect(readFileSync(join(dir, "tweets.md"), "utf8")).toContain("Retries now run.");
    expect(readFileSync(join(dir, "linkedin.md"), "utf8")).toContain("Retries now run.");
    const recorded = JSON.parse(readFileSync(join(dir, "meta.json"), "utf8"));
    expect(recorded).toMatchObject({ kept: 1, costPerKeptUsd: 0.5, rubric: { maxTweets: 3, maxTweetChars: 280 } });
  });

  test("puts each commit link in a reply, not in the tweet text", () => {
    writeDrafts(dir, result, commits, { date: "2026-10-31", mode: "story", selected: 1, skipped: 0, meta });
    const tweets = readFileSync(join(dir, "tweets.md"), "utf8");
    expect(tweets).toContain("Retries now run.\n\nReply with:\nhttps://github.com/abhiudayg/dustmap/commit/1111111111111111111111111111111111111111");
  });

  test("keeps approvals when a draft is rewritten", () => {
    writeFileSync(join(dir, "approved.json"), '["tweet-1"]\n');
    writeDrafts(dir, result, commits, { date: "2026-10-31", mode: "story", selected: 1, skipped: 0, meta });
    expect(readFileSync(join(dir, "approved.json"), "utf8")).toBe('["tweet-1"]\n');
  });

  test("reports the prompt and config versions in the review", () => {
    writeDrafts(dir, result, commits, { date: "2026-10-31", mode: "story", selected: 1, skipped: 0, meta });
    const review = readFileSync(join(dir, "review.md"), "utf8");
    expect(review).toContain(`Prompt: ${"a".repeat(12)}; config: ${"b".repeat(12)}`);
    expect(review).toContain("LinkedIn:");
  });
});
