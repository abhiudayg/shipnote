import { describe, expect, test } from "bun:test";
import { approve, decisionFor, unapprove } from "./approval";

describe("unapprove", () => {
  test("removes an approved draft id", () => {
    expect(unapprove(["tweet-1", "blog"], "tweet-1")).toEqual(["blog"]);
  });

  test("leaves the list unchanged for an id that was never approved", () => {
    expect(unapprove(["blog"], "tweet-2")).toEqual(["blog"]);
  });

  test("approve then unapprove returns to the starting list", () => {
    const ids = ["tweet-1", "blog"];
    expect(unapprove(approve([], "blog", ids), "blog")).toEqual([]);
  });
});

describe("decisionFor", () => {
  test("maps each review key to its decision", () => {
    expect(decisionFor("a")).toBe("approve");
    expect(decisionFor("r")).toBe("reject");
    expect(decisionFor("e")).toBe("edit");
    expect(decisionFor("s")).toBe("skip");
    expect(decisionFor("q")).toBe("quit");
  });

  test("accepts an upper-case key", () => {
    expect(decisionFor("A")).toBe("approve");
  });

  test("returns null for any other key", () => {
    expect(decisionFor("x")).toBeNull();
    expect(decisionFor("\u001b[A")).toBeNull();
  });
});
