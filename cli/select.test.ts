import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { parsePatch } from "./patch";
import { decayByRepo, type Rules, representatives, score, select, topicKey, topicOf } from "./select";

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

const hunk = (count: number) => Array.from({ length: count }, (_, index) => `+line ${index}`).join("\n");
const fileSection = (path: string, count: number) =>
  `diff --git a/${path} b/${path}\n--- a/${path}\n+++ b/${path}\n@@ -0,0 +1,${count} @@\n${hunk(count)}`;
const commitWith = (...sections: string[]) =>
  `commit ${"4".repeat(40)}\nDate: 2026-10-29T10:00:00+05:30\nSubject: Add export retry with backoff\n\nRetries transient errors.\n\n${sections.join("\n")}\n`;

describe("generated and vendored files", () => {
  test("skips a commit whose only changes are generated or vendored files", () => {
    const result = select([{ ...sample[0], files: ["dist/app.js"] }], rules());
    expect(result.skipped).toEqual([{ sha: retrySha, reason: "only generated or vendored files" }]);
  });

  test("scores only source lines when generated files change too", () => {
    const [withGenerated] = parsePatch(commitWith(fileSection("src/retry.ts", 20), fileSection("dist/bundle.js", 500)), "o/r");
    const [sourceOnly] = parsePatch(commitWith(fileSection("src/retry.ts", 20)), "o/r");
    expect(score(withGenerated)).toBe(score(sourceOnly));
  });
});

describe("score", () => {
  const [base] = parsePatch(commitWith(fileSection("src/retry.ts", 20)), "o/r");

  test("prefers a focused change over a very large one", () => {
    expect(score({ ...base, added: 300, removed: 0 })).toBeGreaterThan(score({ ...base, added: 5000, removed: 0 }));
  });

  test("ranks a change in a core directory above a docs-only change", () => {
    expect(score({ ...base, files: ["core/engine.ts"] })).toBeGreaterThan(score({ ...base, files: ["docs/guide.md"] }));
  });

  test("scores a one-word subject below a descriptive one", () => {
    expect(score({ ...base, subject: "cleanup" })).toBeLessThan(score(base));
  });
});

describe("decayByRepo", () => {
  const candidate = (sha: string, repo: string, value: number) => ({ ...sample[0], sha: sha.repeat(40), repo, score: value });

  test("drops each further pick from a repo by the decay factor", () => {
    const ranked = [
      candidate("a", "o/one", 0.9),
      candidate("b", "o/one", 0.8),
      candidate("c", "o/one", 0.7),
      candidate("d", "o/two", 0.5),
    ];
    expect(decayByRepo(ranked).map((item) => item.sha)).toEqual([
      "a".repeat(40),
      "d".repeat(40),
      "b".repeat(40),
      "c".repeat(40),
    ]);
  });
});
