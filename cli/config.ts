import { existsSync, readFileSync } from "node:fs";
import { type Budget, DEFAULT_BUDGET } from "./budget";

export type Provider = {
  command: string;
  args: string[];
  promptMode: "arg" | "stdin";
  model: string;
  effort: string;
  usdPerMillionTokens: number;
};

export type Config = {
  provider: string;
  providers: Record<string, Provider>;
  denylistRepos: string[];
  denylistTerms: string[];
  budget: Budget;
  minStoryScore: number;
  contextTokenBudget: number;
};

const DEFAULT_PROVIDER: Provider = {
  command: "agy",
  args: ["-p", "{prompt}", "--model", "{model}", "--effort", "{effort}"],
  promptMode: "arg",
  model: "gemini-3.8-flash-medium",
  effort: "medium",
  usdPerMillionTokens: 0,
};

export const DEFAULT_CONFIG: Config = {
  provider: "agy",
  providers: { agy: DEFAULT_PROVIDER },
  denylistRepos: [],
  denylistTerms: [],
  budget: DEFAULT_BUDGET,
  minStoryScore: 0.6,
  contextTokenBudget: 4000,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringList(value: unknown, name: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new Error(`${name} must be a list of strings`);
  }
  return value;
}

function number(value: unknown, fallback: number, name: string): number {
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a non-negative number`);
  }
  return value;
}

function toProvider(name: string, value: unknown): Provider {
  if (!isRecord(value)) throw new Error(`agent.providers.${name} must be a table`);
  const { command, args, prompt_mode: promptMode, model, effort } = value;
  if (typeof command !== "string" || command.length === 0) throw new Error(`agent.providers.${name}.command is required`);
  if (promptMode !== "arg" && promptMode !== "stdin") throw new Error(`agent.providers.${name}.prompt_mode must be "arg" or "stdin"`);
  if (typeof model !== "string" || typeof effort !== "string") {
    throw new Error(`agent.providers.${name} needs model and effort strings`);
  }
  return {
    command,
    args: stringList(args, `agent.providers.${name}.args`),
    promptMode,
    model,
    effort,
    usdPerMillionTokens: number(value.usd_per_million_tokens, 0, `agent.providers.${name}.usd_per_million_tokens`),
  };
}

function toBudget(value: unknown): Budget {
  if (value === undefined) return DEFAULT_BUDGET;
  if (!isRecord(value)) throw new Error("[budget] must be a table");
  return {
    maxTokens: number(value.max_tokens_per_run, DEFAULT_BUDGET.maxTokens, "budget.max_tokens_per_run"),
    maxCostUsd: number(value.max_cost_usd_per_run, DEFAULT_BUDGET.maxCostUsd, "budget.max_cost_usd_per_run"),
    maxRetries: number(value.max_retries, DEFAULT_BUDGET.maxRetries, "budget.max_retries"),
  };
}

export function parseConfig(value: unknown): Config {
  if (!isRecord(value)) throw new Error("shipnote.toml must be a table");
  const agent = value.agent ?? {};
  if (!isRecord(agent)) throw new Error("[agent] must be a table");
  let providers: Record<string, Provider> = DEFAULT_CONFIG.providers;
  if (agent.providers !== undefined) {
    if (!isRecord(agent.providers)) throw new Error("[agent.providers] must be a table");
    providers = {};
    for (const [name, provider] of Object.entries(agent.providers)) providers[name] = toProvider(name, provider);
  }
  const provider = typeof agent.provider === "string" ? agent.provider : Object.keys(providers)[0];
  if (!provider || !providers[provider]) throw new Error(`agent.provider "${provider}" is not defined in [agent.providers]`);
  const selection = isRecord(value.selection) ? value.selection : {};
  const context = isRecord(value.context) ? value.context : {};
  return {
    provider,
    providers,
    denylistRepos: stringList(selection.denylist_repos, "selection.denylist_repos"),
    denylistTerms: stringList(selection.denylist_terms, "selection.denylist_terms"),
    budget: toBudget(value.budget),
    minStoryScore: number(selection.min_story_score, DEFAULT_CONFIG.minStoryScore, "selection.min_story_score"),
    contextTokenBudget: number(context.token_budget, DEFAULT_CONFIG.contextTokenBudget, "context.token_budget"),
  };
}

export function loadConfig(path: string): Config {
  if (!existsSync(path)) return DEFAULT_CONFIG;
  return parseConfig(Bun.TOML.parse(readFileSync(path, "utf8")));
}

export function agentCommand(provider: Provider, prompt: string): { argv: string[]; stdin: string | null } {
  const fill = (text: string) =>
    text.replaceAll("{prompt}", prompt).replaceAll("{model}", provider.model).replaceAll("{effort}", provider.effort);
  const argv = [provider.command, ...provider.args.map(fill)];
  return provider.promptMode === "stdin" ? { argv, stdin: prompt } : { argv, stdin: null };
}
