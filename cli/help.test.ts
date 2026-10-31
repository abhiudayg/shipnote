import { describe, expect, test } from "bun:test";
import { commandHelp, rootHelp, type CommandSpec } from "./help";

const commands: Record<string, CommandSpec> = {
  draft: {
    summary: "Draft tweets and a blog post from the selected commits",
    usage: "draft [--date YYYY-MM-DD] [--top N]",
    options: [
      ["--date YYYY-MM-DD", "Day to draft"],
      ["--top N", "Commits to draft from in story mode"],
    ],
  },
  stats: { summary: "Report the approval rate", usage: "stats", options: [] },
};

describe("rootHelp", () => {
  test("lists global options, commands with their summaries, and the version", () => {
    const text = rootHelp("0.2.1", commands);
    expect(text).toContain("Usage:  shipnote [OPTIONS] COMMAND");
    expect(text).toContain("-v, --verbose");
    expect(text).toContain("  draft  Draft tweets and a blog post from the selected commits");
    expect(text).toContain("Run 'shipnote COMMAND --help'");
    expect(text).toContain("Version 0.2.1");
  });
});

describe("commandHelp", () => {
  test("shows the usage line, the summary, and the command's options", () => {
    const text = commandHelp(commands.draft);
    expect(text).toContain("Usage:  shipnote draft [--date YYYY-MM-DD] [--top N]");
    expect(text).toContain("Draft tweets and a blog post from the selected commits");
    expect(text).toMatch(/--top N\s+Commits to draft from in story mode/);
  });

  test("says when a command has no options of its own", () => {
    expect(commandHelp(commands.stats)).toContain("No command options");
  });
});
