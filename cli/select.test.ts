import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { parsePatch } from "./patch";
import { type Rules, representatives, score, select, topicKey, topicOf } from "./select";

const sample = parsePatch(readFileSync(new URL("./fixtures/sample.patch", import.meta.url), "utf8"), "abhiudayg/dustmap");
const retrySha = "1111111111111111111111111111111111111111";
const mergeSha = "2222222222222222222222222222222222222222";
const lockSha = "3333333333333333333333333333333333333333";

function rules(overrides: Partial<Rules> = {}): Rules {
  return { used: new Set(), denylistRepos: new Set(), denylistTerms: [], ...overrides };
}

describe("parsePatch", () => {
  test("reads every commit with its metadata", () => {
    expect(sample.map((c) => c.sha)).toEqual([retrySha, mergeSha, lockSha]);
    expect(sample[0]).toMatchObject({
      repo: "abhiudayg/dustmap",
      date: "2026-10-29T10:00:00+05:30",
      subject: "Add export retry with backoff",
      body: "Retries transient GitHub errors three times.",
      files: ["scripts/retry.sh"],
      newFiles: 1,
      added: 4,
      removed: 0,
    });
  });

  test("counts added and removed lines without counting file headers", () => {
    expect(sample[1]).toMatchObject({ files: ["README.md"], added: 1, removed: 1 });
  });

  test("returns no commits for empty input", () => {
    expect(parsePatch("", "abhiudayg/dustmap")).toEqual([]);
  });
});

describe("select", () => {
  test("keeps the substantive commit and skips merges and lockfile-only commits", () => {
    const result = select(sample, rules());
    expect(result.selected.map((c) => c.sha)).toEqual([retrySha]);
    expect(result.skipped).toEqual([
      { sha: mergeSha, reason: "merge commit" },
      { sha: lockSha, reason: "lockfile only" },
    ]);
  });

  test("skips commits already in the used ledger", () => {
    const result = select(sample, rules({ used: new Set([retrySha]) }));
    expect(result.selected).toEqual([]);
    expect(result.skipped[0]).toEqual({ sha: retrySha, reason: "already used" });
  });

  test("skips every commit from a denylisted repo", () => {
    const result = select(sample, rules({ denylistRepos: new Set(["abhiudayg/dustmap"]) }));
    expect(result.selected).toEqual([]);
    expect(result.skipped.every((skip) => skip.reason === "denylisted repo")).toBe(true);
  });

  test("skips a commit whose message contains a denylisted term, ignoring case", () => {
    const result = select(sample, rules({ denylistTerms: ["RETRY"] }));
    expect(result.skipped[0]).toEqual({ sha: retrySha, reason: "denylisted term" });
  });

  test("ranks a larger change above a smaller one", () => {
    const [small] = select(sample, rules()).selected;
    const large = { ...small, added: 3000, removed: 200, newFiles: 4 };
    expect(score(large)).toBeGreaterThan(score(small));
  });

  test("scores the selected commit between 0 and 1", () => {
    const [only] = select(sample, rules()).selected;
    expect(only.score).toBeGreaterThan(0);
    expect(only.score).toBeLessThanOrEqual(1);
  });
});

describe("representatives", () => {
  const base = { sha: "", repo: "o/r", date: "", subject: "", body: "", files: [] as string[], newFiles: 0, added: 0, removed: 0, diff: "" };
  const commit = (sha: string, repo: string, file: string) => ({ ...base, sha: sha.repeat(40), repo, files: [file] });

  test("keeps the highest-scoring commit for each topic", () => {
    const ranked = [commit("a", "o/r", "cli/x.ts"), commit("b", "o/r", "cli/y.ts"), commit("c", "o/r", "docs/z.md")];
    expect(representatives(ranked).map((item) => item.sha)).toEqual(["a".repeat(40), "c".repeat(40)]);
  });

  test("treats the same top-level folder in different repos as different topics", () => {
    const ranked = [commit("a", "o/one", "cli/x.ts"), commit("b", "o/two", "cli/y.ts")];
    expect(representatives(ranked)).toHaveLength(2);
  });

  test("names a topic by repo and top-level folder", () => {
    expect(topicOf(commit("a", "o/r", "cli/x.ts"))).toBe("o/r/cli");
  });
});

describe("topicKey", () => {
  test("matches the topic a commit is grouped under", () => {
    expect(topicKey("o/r", ["cli/x.ts"])).toBe("o/r/cli");
  });
});

describe("topicKey area", () => {
  test("uses the folder that most of the commit's files are in", () => {
    expect(topicKey("o/r", [".github/ci.yml", "internal/a.go", "internal/b.go"])).toBe("o/r/internal");
  });

  test("breaks ties by folder name", () => {
    expect(topicKey("o/r", ["b/x.go", "a/y.go"])).toBe("o/r/a");
  });
});

describe("topicKey depth", () => {
  test("uses two folder levels when files sit deeper", () => {
    expect(topicKey("o/r", ["internal/session/a.go", "internal/session/b.go", "internal/policy/c.go"])).toBe(
      "o/r/internal/session",
    );
  });

  test("uses the file itself for a file at the repository root", () => {
    expect(topicKey("o/r", ["README.md"])).toBe("o/r/README.md");
  });
});
