import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { importDocs } from "./docs";
import { commitUrl } from "./platforms";
import { parsePatch } from "./patch";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "shipnote-docs-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function readBack(destination: string, folder: string) {
  const patch = readFileSync(join(destination, "docs", `${folder}.patch`), "utf8");
  return parsePatch(patch, `docs/${folder}`);
}

describe("importDocs", () => {
  test("stores each markdown file as one entry with its heading as subject", () => {
    const source = join(root, "notes");
    mkdirSync(join(source, "drafts"), { recursive: true });
    writeFileSync(join(source, "launch.md"), "# Launch plan\n\nShip the export on Friday.\n");
    writeFileSync(join(source, "drafts", "retro.md"), "Retro notes with no heading.\n");
    const destination = join(root, "archive");

    expect(importDocs(source, destination)).toEqual(["drafts/retro.md", "launch.md"]);

    const commits = readBack(destination, "notes");
    expect(commits).toHaveLength(2);
    expect(commits[1]).toMatchObject({
      repo: "docs/notes",
      subject: "Launch plan",
      files: ["launch.md"],
      newFiles: 1,
    });
    expect(commits[1].sha).toMatch(/^[0-9a-f]{40}$/);
    expect(commits[0].subject).toBe("drafts/retro.md");
  });

  test("keeps a document's id the same when it is imported again", () => {
    const source = join(root, "notes");
    mkdirSync(source);
    writeFileSync(join(source, "launch.md"), "# Launch plan\n");
    const first = join(root, "first");
    const second = join(root, "second");

    importDocs(source, first);
    importDocs(source, second);

    expect(readBack(first, "notes")[0].sha).toBe(readBack(second, "notes")[0].sha);
  });

  test("ignores files that are not markdown", () => {
    const source = join(root, "notes");
    mkdirSync(source);
    writeFileSync(join(source, "launch.md"), "# Launch plan\n");
    writeFileSync(join(source, "secrets.txt"), "not a document\n");

    expect(importDocs(source, join(root, "archive"))).toEqual(["launch.md"]);
  });

  test("refuses a folder with no markdown files", () => {
    const source = join(root, "empty");
    mkdirSync(source);

    expect(() => importDocs(source, join(root, "archive"))).toThrow("no .md files found");
  });
});

describe("commitUrl", () => {
  test("gives no GitHub link for a document", () => {
    expect(commitUrl("docs/notes", "a".repeat(40))).toBeNull();
  });

  test("links a commit to its repository", () => {
    expect(commitUrl("abhiudayg/shipnote", "a".repeat(40))).toBe(
      `https://github.com/abhiudayg/shipnote/commit/${"a".repeat(40)}`,
    );
  });
});
