import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { importPatches } from "./archive";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "shipnote-archive-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("importPatches", () => {
  test("copies owner/repo.patch files into the destination, keeping their layout", () => {
    const source = join(root, "source");
    mkdirSync(join(source, "owner"), { recursive: true });
    writeFileSync(join(source, "owner", "repo.patch"), "commit a\n");
    const destination = join(root, "archive", "2026-10-30");

    const copied = importPatches(source, destination);

    expect(copied).toEqual(["owner/repo.patch"]);
    expect(readFileSync(join(destination, "owner", "repo.patch"), "utf8")).toBe("commit a\n");
  });

  test("accepts an artifact-style folder with the owner inside a subfolder", () => {
    const source = join(root, "source", "dataset-123", "owner");
    mkdirSync(source, { recursive: true });
    writeFileSync(join(source, "repo.patch"), "commit b\n");
    const destination = join(root, "archive");

    expect(importPatches(join(root, "source"), destination)).toEqual(["dataset-123/owner/repo.patch"]);
  });

  test("rejects a patch that is not under an owner folder", () => {
    const source = join(root, "source");
    mkdirSync(source, { recursive: true });
    writeFileSync(join(source, "repo.patch"), "commit c\n");

    expect(() => importPatches(source, join(root, "archive"))).toThrow("expected <owner>/<repo>.patch");
  });

  test("fails when the folder has no patch files", () => {
    const source = join(root, "empty");
    mkdirSync(source, { recursive: true });

    expect(() => importPatches(source, join(root, "archive"))).toThrow("no .patch files found");
    expect(existsSync(join(root, "archive"))).toBe(false);
  });
});
