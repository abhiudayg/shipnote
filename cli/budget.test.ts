import { describe, expect, test } from "bun:test";
import { checkBudget, DEFAULT_BUDGET, estimateCostUsd, estimateTokens } from "./budget";

describe("estimateTokens", () => {
  test("rounds up to about four characters per token", () => {
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("abcde")).toBe(2);
  });
});

describe("estimateCostUsd", () => {
  test("prices tokens per million", () => {
    expect(estimateCostUsd(500000, 2)).toBe(1);
  });

  test("is zero for a provider with no price set", () => {
    expect(estimateCostUsd(500000, 0)).toBe(0);
  });
});

describe("checkBudget", () => {
  test("allows a prompt within both limits", () => {
    expect(checkBudget(1000, 0, DEFAULT_BUDGET)).toBeNull();
  });

  test("refuses a prompt over the token limit", () => {
    const reason = checkBudget(300000, 0, DEFAULT_BUDGET);
    expect(reason).toContain("over the 200000 token limit");
  });

  test("refuses a prompt whose estimated cost is over the dollar limit", () => {
    const reason = checkBudget(100000, 50, { ...DEFAULT_BUDGET, maxCostUsd: 1 });
    expect(reason).toContain("over the $1 limit");
  });

  test("allows a prompt exactly at the token limit", () => {
    expect(checkBudget(200000, 0, DEFAULT_BUDGET)).toBeNull();
  });
});
