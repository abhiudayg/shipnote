import { describe, expect, test } from "bun:test";
import { parseRecall, recallFacts, withTag, type Runner } from "./recall";

const fact = (id: string, text: string, tags: string[]) => ({ schema_version: 1, id, text, tags, created: "2026-10-30T00:00:00Z", source: "manual" });
const output = (facts: unknown[]) => JSON.stringify(facts);

describe("parseRecall", () => {
  test("reads each fact's id, text, tags, source, and created time", () => {
    const [parsed] = parseRecall(output([fact("1", "I write plainly.", ["voice"])]));
    expect(parsed).toEqual({ id: "1", text: "I write plainly.", tags: ["voice"], source: "manual", created: "2026-10-30T00:00:00Z" });
  });

  test("accepts an empty list", () => {
    expect(parseRecall("[]")).toEqual([]);
  });

  test("rejects output that is not a JSON array", () => {
    expect(() => parseRecall('{"facts": []}')).toThrow("not a JSON array");
  });

  test("rejects a fact without tags", () => {
    expect(() => parseRecall(output([{ id: "1", text: "x" }]))).toThrow("needs id, text, and a list of tags");
  });
});

describe("withTag", () => {
  test("keeps only facts that carry the tag", () => {
    const facts = parseRecall(output([fact("1", "voice", ["voice"]), fact("2", "other", ["project"])]));
    expect(withTag(facts, "voice").map((f) => f.id)).toEqual(["1"]);
  });
});

describe("recallFacts", () => {
  test("runs agent-brain recall with --json and no query when none is given", async () => {
    const seen: string[][] = [];
    const run: Runner = async (argv) => {
      seen.push(argv);
      return output([fact("1", "voice sample", ["voice"])]);
    };
    const result = await recallFacts(run, null, "voice");
    expect(seen[0]).toEqual(["agent-brain", "recall", "--json"]);
    expect(result).toEqual({ facts: [expect.objectContaining({ id: "1" })], error: null });
  });

  test("passes the query before --json when one is given", async () => {
    const seen: string[][] = [];
    await recallFacts(async (argv) => (seen.push(argv), "[]"), "gitleaks", "voice");
    expect(seen[0]).toEqual(["agent-brain", "recall", "gitleaks", "--json"]);
  });

  test("returns no facts and no error when nothing matches", async () => {
    expect(await recallFacts(async () => "[]", null, "voice")).toEqual({ facts: [], error: null });
  });

  test("reports a failed command without throwing", async () => {
    const result = await recallFacts(async () => {
      throw new Error("exit 1: not found");
    }, null, "voice");
    expect(result).toEqual({ facts: [], error: "exit 1: not found" });
  });

  test("reports unreadable output without throwing", async () => {
    const result = await recallFacts(async () => "not json", null, "voice");
    expect(result.facts).toEqual([]);
    expect(result.error).not.toBeNull();
  });
});
