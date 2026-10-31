import { describe, expect, test } from "bun:test";
import { importCorpus, storeFact } from "./memory";
import type { Runner } from "./recall";

const recording = (output: string) => {
  const seen: string[][] = [];
  const run: Runner = async (argv) => {
    seen.push(argv);
    return output;
  };
  return { seen, run };
};

describe("storeFact", () => {
  test("runs agent-brain remember with the text, tag, and source", async () => {
    const { seen, run } = recording('{"id":"1","deduplicated":false}');
    await storeFact(run, "I write plainly.", "voice", "voice/a.md#paragraph-1");
    expect(seen[0]).toEqual(["agent-brain", "remember", "--text", "I write plainly.", "--tag", "voice", "--source", "voice/a.md#paragraph-1"]);
  });

  test("returns the stored id and whether it was deduplicated", async () => {
    const { run } = recording('{"id":"1","deduplicated":true}');
    expect(await storeFact(run, "I write plainly.", "voice", "manual")).toEqual({ id: "1", deduplicated: true });
  });

  test("refuses secret-shaped text without calling agent-brain", async () => {
    const { seen, run } = recording("{}");
    await expect(storeFact(run, "token ghp_abcdefghijklmnopqrstuvwxyz", "voice", "manual")).rejects.toThrow("secret pattern");
    expect(seen).toEqual([]);
  });

  test("propagates an agent-brain failure", async () => {
    const run: Runner = async () => {
      throw new Error("exit 1: refused");
    };
    await expect(storeFact(run, "I write plainly.", "voice", "manual")).rejects.toThrow("exit 1: refused");
  });
});

describe("importCorpus", () => {
  test("runs agent-brain import-corpus on the folder with the tag", async () => {
    const { seen, run } = recording('{"files":1,"paragraphs":2,"stored":2,"deduplicated":0,"rejected_secret":0,"rejected_too_long":0}');
    await importCorpus(run, "voice", "voice");
    expect(seen[0]).toEqual(["agent-brain", "import-corpus", "voice", "--tag", "voice"]);
  });

  test("returns the import report", async () => {
    const report = { files: 2, paragraphs: 3, stored: 0, deduplicated: 3, rejected_secret: 0, rejected_too_long: 0 };
    const { run } = recording(JSON.stringify(report));
    expect(await importCorpus(run, "voice", "voice")).toEqual(report);
  });
});
