import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { agentCommand, DEFAULT_CONFIG, loadConfig, parseConfig } from "./config";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "shipnote-config-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("parseConfig", () => {
  test("reads the provider, its model, and the denylist", () => {
    const config = parseConfig({
      agent: {
        provider: "claude",
        providers: {
          claude: { command: "claude", args: ["-p", "--model", "{model}"], prompt_mode: "stdin", model: "sonnet", effort: "low" },
        },
      },
      selection: { denylist_repos: ["me/client"], denylist_terms: ["confidential"] },
    });
    expect(config.provider).toBe("claude");
    expect(config.providers.claude).toMatchObject({ command: "claude", promptMode: "stdin", model: "sonnet" });
    expect(config.denylistRepos).toEqual(["me/client"]);
    expect(config.denylistTerms).toEqual(["confidential"]);
  });

  test("an empty table uses the agy default", () => {
    expect(parseConfig({})).toEqual(DEFAULT_CONFIG);
  });

  test("rejects a provider that is not defined", () => {
    expect(() => parseConfig({ agent: { provider: "nope", providers: { agy: { command: "agy", prompt_mode: "arg", model: "m", effort: "e" } } } })).toThrow(
      'agent.provider "nope" is not defined',
    );
  });

  test("rejects an unknown prompt mode", () => {
    expect(() => parseConfig({ agent: { providers: { agy: { command: "agy", prompt_mode: "file", model: "m", effort: "e" } } } })).toThrow(
      'prompt_mode must be "arg" or "stdin"',
    );
  });

  test("rejects a denylist that is not a list of strings", () => {
    expect(() => parseConfig({ selection: { denylist_repos: "me/client" } })).toThrow("must be a list of strings");
  });
});

describe("loadConfig", () => {
  test("a missing file gives the defaults", () => {
    expect(loadConfig(join(root, "shipnote.toml"))).toEqual(DEFAULT_CONFIG);
  });

  test("reads a TOML file", () => {
    const path = join(root, "shipnote.toml");
    writeFileSync(path, '[selection]\ndenylist_repos = ["me/private"]\n');
    expect(loadConfig(path).denylistRepos).toEqual(["me/private"]);
  });
});

describe("agentCommand", () => {
  test("fills the placeholders and passes the prompt as an argument", () => {
    const { argv, stdin } = agentCommand(DEFAULT_CONFIG.providers.agy, "hello");
    expect(argv).toEqual(["agy", "-p", "hello", "--model", "gemini-3.8-flash-medium", "--effort", "medium"]);
    expect(stdin).toBeNull();
  });

  test("sends the prompt on stdin when the provider asks for it", () => {
    const provider = { ...DEFAULT_CONFIG.providers.agy, promptMode: "stdin" as const, args: ["-p", "--model", "{model}"] };
    const { argv, stdin } = agentCommand(provider, "hello");
    expect(argv).toEqual(["agy", "-p", "--model", "gemini-3.8-flash-medium"]);
    expect(stdin).toBe("hello");
  });
});

describe("budget settings", () => {
  test("reads the budget table", () => {
    const config = parseConfig({ budget: { max_tokens_per_run: 5000, max_cost_usd_per_run: 0.5, max_retries: 1 } });
    expect(config.budget).toEqual({ maxTokens: 5000, maxCostUsd: 0.5, maxRetries: 1 });
  });

  test("uses defaults when the budget table is missing", () => {
    expect(parseConfig({}).budget.maxRetries).toBe(2);
  });

  test("rejects a negative limit", () => {
    expect(() => parseConfig({ budget: { max_tokens_per_run: -1 } })).toThrow("must be a non-negative number");
  });

  test("reads an optional provider price", () => {
    const config = parseConfig({ agent: { providers: { agy: { command: "agy", prompt_mode: "arg", model: "m", effort: "e", usd_per_million_tokens: 0.3 } } } });
    expect(config.providers.agy.usdPerMillionTokens).toBe(0.3);
  });
});
