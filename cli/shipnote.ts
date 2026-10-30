import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { parsePatch, type Commit } from "./patch";
import { select } from "./select";

const ARCHIVE = "archive";
const LEDGER = "ledger.json";

const repo = process.env.SHIPNOTE_REPO ?? "abhiudayg/shipnote";
const denylist = new Set((process.env.SHIPNOTE_DENYLIST ?? "").split(",").filter(Boolean));

function today(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

function flag(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

async function latestRunId(): Promise<string> {
  const runs = await Bun.$`gh run list --repo ${repo} --workflow nightly-dataset.yml --status success --limit 1 --json databaseId --jq ${".[0].databaseId"}`.text();
  const id = runs.trim();
  if (!id) throw new Error(`no successful nightly-dataset run found for ${repo}`);
  return id;
}

async function fetchDataset(args: string[]): Promise<void> {
  const date = flag(args, "--date") ?? today();
  const dir = join(ARCHIVE, date);
  if (existsSync(dir)) {
    console.log(`already archived: ${dir}`);
    return;
  }

  const runId = flag(args, "--run") ?? (await latestRunId());
  try {
    await Bun.$`gh run download ${runId} --repo ${repo} --dir ${dir}`.quiet();
  } catch (error) {
    rmSync(dir, { recursive: true, force: true });
    throw error;
  }
  console.log(`archived run ${runId} to ${dir}`);
}

async function loadCommits(dir: string): Promise<Commit[]> {
  if (!existsSync(dir)) throw new Error(`no archive for this date: ${dir}. Run "shipnote fetch" first.`);
  const commits: Commit[] = [];
  for await (const file of new Bun.Glob("**/*.patch").scan(dir)) {
    const repoName = file.replace(/\.patch$/, "").split("/").slice(-2).join("/");
    commits.push(...parsePatch(readFileSync(join(dir, file), "utf8"), repoName));
  }
  return commits;
}

function loadLedger(): Set<string> {
  if (!existsSync(LEDGER)) return new Set();
  return new Set(JSON.parse(readFileSync(LEDGER, "utf8")) as string[]);
}

async function selectCommits(args: string[]): Promise<void> {
  const date = flag(args, "--date") ?? today();
  const commits = await loadCommits(join(ARCHIVE, date));
  const result = select(commits, loadLedger(), denylist);

  console.log(`${date}: ${commits.length} commits, ${result.selected.length} selected, ${result.skipped.length} skipped\n`);
  for (const [rank, commit] of result.selected.entries()) {
    console.log(`${String(rank + 1).padStart(2)}. ${commit.score.toFixed(3)}  ${commit.sha.slice(0, 7)}  ${commit.repo}  ${commit.subject}`);
  }

  const reasons = new Map<string, number>();
  for (const skip of result.skipped) reasons.set(skip.reason, (reasons.get(skip.reason) ?? 0) + 1);
  if (reasons.size > 0) {
    console.log("\nskipped:");
    for (const [reason, count] of reasons) console.log(`  ${count} ${reason}`);
  }
}

const [command, ...args] = process.argv.slice(2);

const commands: Record<string, (args: string[]) => Promise<void>> = {
  fetch: fetchDataset,
  select: selectCommits,
};

if (!command || !commands[command]) {
  console.log("usage: shipnote <fetch|select> [--date YYYY-MM-DD] [--run ID]");
  process.exit(command ? 1 : 0);
}

await commands[command](args);
