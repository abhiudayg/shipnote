import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { evaluateCase, type EvalCase, summarize } from "./eval";
import { parsePatch } from "./patch";

const commits = parsePatch(readFileSync(new URL("./fixtures/sample.patch", import.meta.url), "utf8"), "abhiudayg/dustmap");
const retrySha = "1111111111111111111111111111111111111111";
const evalCase: EvalCase = { name: "retry", expectMode: "story", notes: "mentions retries", commits };

describe("evaluateCase", () => {
  test("counts a valid tweet as kept and a fabricated SHA as rejected", async () => {
    const raw = JSON.stringify({
      tweets: [
        { text: "Retries now run three times.", shas: [retrySha] },
        { text: "Made up.", shas: ["9".repeat(40)] },
      ],
      blog: null,
    });
    const result = await evaluateCase(evalCase, 0.6, "", async () => raw);
    expect(result).toMatchObject({ parsed: true, produced: 2, kept: 1, error: null });
  });

  test("records an agent failure without throwing", async () => {
    const result = await evaluateCase(evalCase, 0.6, "", async () => {
      throw new Error("timed out");
    });
    expect(result).toMatchObject({ parsed: false, error: "agent call failed: timed out" });
  });

  test("records unreadable output", async () => {
    const result = await evaluateCase(evalCase, 0.6, "", async () => "no json");
    expect(result.parsed).toBe(false);
    expect(result.error).toContain("unreadable output");
  });

  test("marks a mode mismatch against the expected mode", async () => {
    const result = await evaluateCase({ ...evalCase, expectMode: "theme" }, 0.6, "", async () => "{}");
    expect(result.modeMatch).toBe(false);
  });
});

describe("summarize", () => {
  test("reports rates across cases", () => {
    const summary = summarize([
      { name: "a", expectMode: "story", mode: "story", modeMatch: true, parsed: true, produced: 2, kept: 1, error: null },
      { name: "b", expectMode: "story", mode: "theme", modeMatch: false, parsed: false, produced: 0, kept: 0, error: "x" },
    ]);
    expect(summary).toEqual({ cases: 2, modeMatchRate: 0.5, parseRate: 0.5, validationPassRate: 0.5 });
  });

  test("returns zeros for no cases", () => {
    expect(summarize([])).toEqual({ cases: 0, modeMatchRate: 0, parseRate: 0, validationPassRate: 0 });
  });
});
