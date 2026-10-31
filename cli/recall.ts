import { debug } from "./log";

export type Fact = {
  id: string;
  text: string;
  tags: string[];
  source: string | null;
  created: string | null;
};

export type RecallResult = { facts: Fact[]; error: string | null };

export type Runner = (argv: string[]) => Promise<string>;

function toFact(value: unknown): Fact {
  if (typeof value !== "object" || value === null) throw new Error("fact is not an object");
  const record = value as Record<string, unknown>;
  const { id, text, tags } = record;
  if (typeof id !== "string" || typeof text !== "string" || !Array.isArray(tags) || !tags.every((tag) => typeof tag === "string")) {
    throw new Error("fact needs id, text, and a list of tags");
  }
  return {
    id,
    text,
    tags,
    source: typeof record.source === "string" ? record.source : null,
    created: typeof record.created === "string" ? record.created : null,
  };
}

export function parseRecall(stdout: string): Fact[] {
  const value: unknown = JSON.parse(stdout);
  if (!Array.isArray(value)) throw new Error("recall output is not a JSON array");
  return value.map(toFact);
}

export function withTag(facts: Fact[], tag: string): Fact[] {
  return facts.filter((fact) => fact.tags.includes(tag));
}

export async function recallFacts(run: Runner, query: string | null, tag: string): Promise<RecallResult> {
  try {
    const argv = ["agent-brain", "recall", ...(query ? [query] : []), "--json"];
    return { facts: withTag(parseRecall(await run(argv)), tag), error: null };
  } catch (error) {
    return { facts: [], error: (error as Error).message };
  }
}

export async function runCommand(argv: string[]): Promise<string> {
  debug(argv.join(" "));
  const proc = Bun.spawn(argv, { stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (code !== 0) throw new Error(`exit ${code}: ${stderr.trim()}`);
  return stdout;
}
