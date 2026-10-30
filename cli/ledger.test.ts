import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { approve, draftIds, readApproved, writeApproved } from "./approval";
import { mergeLedger, readLedger, validateShas, writeLedger } from "./ledger";

const sha = "a".repeat(40);
const otherSha = "b".repeat(40);

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "shipnote-ledger-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("validateShas", () => {
  test("accepts full lowercase SHAs", () => {
    expect(validateShas([sha])).toEqual([sha]);
  });

  test("rejects a short SHA", () => {
    expect(() => validateShas(["abc1234"])).toThrow("not a full 40-character commit SHA");
  });

  test("rejects uppercase hex", () => {
    expect(() => validateShas(["A".repeat(40)])).toThrow("not a full 40-character commit SHA");
  });
});

describe("mergeLedger", () => {
  test("adds new SHAs once and keeps the list sorted", () => {
    expect(mergeLedger([otherSha], [sha, otherSha])).toEqual([sha, otherSha]);
  });
});

describe("readLedger and writeLedger", () => {
  test("a missing ledger is empty", () => {
    expect(readLedger(join(root, "ledger.json"))).toEqual([]);
  });

  test("round-trips the SHAs", () => {
    const path = join(root, "ledger.json");
    writeLedger(path, [sha]);
    expect(readLedger(path)).toEqual([sha]);
  });

  test("rejects a ledger that is not an array of strings", () => {
    const path = join(root, "ledger.json");
    writeFileSync(path, '{"used": []}');
    expect(() => readLedger(path)).toThrow("must be a JSON array of commit SHAs");
  });
});

describe("approve", () => {
  test("adds a known draft id", () => {
    expect(approve([], "tweet-1", ["tweet-1", "blog"])).toEqual(["tweet-1"]);
  });

  test("approving twice keeps one entry", () => {
    expect(approve(["blog"], "blog", ["blog"])).toEqual(["blog"]);
  });

  test("rejects an id that is not in the drafts", () => {
    expect(() => approve([], "tweet-9", ["tweet-1"])).toThrow("no draft named tweet-9");
  });
});

describe("draftIds", () => {
  test("turns claim items into ids", () => {
    expect(draftIds(["tweet 1", "blog"])).toEqual(["tweet-1", "blog"]);
  });
});

describe("approved file", () => {
  test("round-trips the approved ids", () => {
    const path = join(root, "approved.json");
    writeApproved(path, ["blog"]);
    expect(readApproved(path)).toEqual(["blog"]);
  });

  test("a missing approved file is empty", () => {
    expect(readApproved(join(root, "approved.json"))).toEqual([]);
  });
});
