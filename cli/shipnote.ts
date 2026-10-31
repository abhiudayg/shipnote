import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { approve, draftIds, readApproved, writeApproved } from "./approval";
import { importPatches } from "./archive";
import { checkBudget, estimateCostUsd, estimateTokens } from "./budget";
import { altText, BLOG_SIZE, excerptCard, excerptMatchesDiff, firstExcerpt, TWEET_SIZE } from "./media";
import { evaluateCase, type EvalCase, summarize } from "./eval";
import { importCorpus, storeFact } from "./memory";
import { recallFacts, runCommand } from "./recall";
import { score } from "./select";
import { agentCommand, loadConfig, type Config, type Provider } from "./config";
import { mergeLedger, readLedger, validateShas, writeLedger } from "./ledger";
import { buildPrompt, check, chooseMode, MAX_TWEET_CHARS, parseDraft } from "./draft";
import { parsePatch, type Commit } from "./patch";
import { writeDrafts } from "./output";
import { select, type Rules } from "./select";

const ARCHIVE = "archive";
const DRAFTS = "drafts";
const VOICE_DIR = "voice";
const EVAL_CASES = join("eval", "cases");
const EVAL_RESULTS = join("eval", "results");
const THEME_EXAMPLES = 10;
const LEDGER = "ledger.json";

const CONFIG = "shipnote.toml";

const repo = process.env.SHIPNOTE_REPO ?? "abhiudayg/shipnote";

function currentRules(config: Config): Rules {
  const envRepos = (process.env.SHIPNOTE_DENYLIST ?? "").split(",").filter(Boolean);
  return {
    used: loadLedger(),
    denylistRepos: new Set([...config.denylistRepos, ...envRepos]),
    denylistTerms: config.denylistTerms,
  };
}

function resolvedProvider(config: Config): Provider {
  const base = config.providers[config.provider];
  return {
    ...base,
    model: process.env.SHIPNOTE_MODEL ?? base.model,
    effort: process.env.SHIPNOTE_EFFORT ?? base.effort,
  };
}

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
  return new Set(readLedger(LEDGER));
}

const VALUE_FLAGS = ["--date", "--tag", "--source"];

function positionals(args: string[]): string[] {
  return args.filter((arg, index) => !arg.startsWith("--") && !(index > 0 && VALUE_FLAGS.includes(args[index - 1])));
}

function draftPath(date: string, file: string): string {
  return join(DRAFTS, date, file);
}

function claimItems(date: string): string[] {
  const path = draftPath(date, "sources.json");
  if (!existsSync(path)) throw new Error(`no drafts for ${date}; run "shipnote draft --date ${date}" first`);
  const sources = JSON.parse(readFileSync(path, "utf8")) as { claims: Array<{ item: string }> };
  return sources.claims.map((claim) => claim.item);
}

async function approveDraft(args: string[]): Promise<void> {
  const [id] = positionals(args);
  if (!id) throw new Error("usage: shipnote approve <draft-id> [--date YYYY-MM-DD]");
  const date = flag(args, "--date") ?? today();
  const path = draftPath(date, "approved.json");
  const approved = approve(readApproved(path), id, draftIds(claimItems(date)));
  writeApproved(path, approved);
  console.log(`approved ${id} for ${date}. Nothing was posted.`);
}

async function markUsed(args: string[]): Promise<void> {
  const shas = positionals(args);
  if (shas.length === 0) throw new Error("usage: shipnote mark-used <sha> [<sha> ...]");
  validateShas(shas);
  const merged = mergeLedger(readLedger(LEDGER), shas);
  writeLedger(LEDGER, merged);
  console.log(`marked ${shas.length} commit(s) as used; ledger holds ${merged.length}`);
}

async function showStatus(args: string[]): Promise<void> {
  const date = flag(args, "--date") ?? today();
  const dir = join(DRAFTS, date);
  if (!existsSync(dir)) {
    console.log(`${date}: no drafts. Run "shipnote draft --date ${date}".`);
  } else {
    const items = claimItems(date);
    const approved = readApproved(draftPath(date, "approved.json"));
    console.log(`${date}: drafts ${items.length > 0 ? items.join(", ") : "none"}`);
    console.log(`approved: ${approved.length > 0 ? approved.join(", ") : "none"}`);
  }
  console.log(`ledger: ${readLedger(LEDGER).length} used commit(s)`);
}

async function selectCommits(args: string[]): Promise<void> {
  const date = flag(args, "--date") ?? today();
  const commits = await loadCommits(join(ARCHIVE, date));
  const result = select(commits, currentRules(loadConfig(CONFIG)));

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

async function callAgent(provider: Provider, prompt: string): Promise<string> {
  const { argv, stdin } = agentCommand(provider, prompt);
  const proc = Bun.spawn(argv, {
    stdin: stdin === null ? "ignore" : new Blob([stdin]),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (code !== 0) throw new Error(`agent exited ${code}: ${stderr.trim()}`);
  return stdout;
}

function loadCases(): EvalCase[] {
  if (!existsSync(EVAL_CASES)) return [];
  return [...new Bun.Glob("*.json").scanSync(EVAL_CASES)].sort().map((file) => {
    const value = JSON.parse(readFileSync(join(EVAL_CASES, file), "utf8")) as EvalCase;
    if (typeof value.name !== "string" || typeof value.notes !== "string" || !Array.isArray(value.commits) || value.commits.length === 0) {
      throw new Error(`${file} is not a valid eval case`);
    }
    return value;
  });
}

async function evalAdd(args: string[]): Promise<void> {
  const [name] = positionals(args);
  const date = flag(args, "--date");
  const shas = (flag(args, "--sha") ?? "").split(",").filter(Boolean);
  const expectMode = flag(args, "--expect") ?? "story";
  const notes = flag(args, "--notes");
  if (!name || !date || shas.length === 0 || !notes) {
    throw new Error("usage: shipnote eval-add <name> --date D --sha SHA[,SHA] --expect story|theme --notes TEXT");
  }
  if (expectMode !== "story" && expectMode !== "theme") throw new Error(`--expect must be story or theme`);
  const commits = await loadCommits(join(ARCHIVE, date));
  const chosen = shas.map((prefix) => {
    const matches = commits.filter((commit) => commit.sha.startsWith(prefix));
    if (matches.length !== 1) throw new Error(`expected one commit starting with ${prefix}, found ${matches.length}`);
    return matches[0];
  });
  mkdirSync(EVAL_CASES, { recursive: true });
  const evalCase: EvalCase = { name, expectMode, notes, commits: chosen };
  writeFileSync(join(EVAL_CASES, `${name}.json`), `${JSON.stringify(evalCase, null, 2)}\n`);
  console.log(`saved case ${name} with ${chosen.length} commit(s)`);
}

async function runEval(args: string[]): Promise<void> {
  const config = loadConfig(CONFIG);
  const provider = resolvedProvider(config);
  const cases = loadCases();
  if (cases.length === 0) throw new Error(`no eval cases in ${EVAL_CASES}; add one with eval-add`);
  const voice = (await loadVoice(config)).text;

  if (args.includes("--dry-run")) {
    for (const evalCase of cases) {
      const mode = chooseMode(Math.max(...evalCase.commits.map(score)), config.minStoryScore);
      const tokens = estimateTokens(buildPrompt(evalCase.commits, mode, voice));
      console.log(`${evalCase.name}: mode ${mode} (expected ${evalCase.expectMode}), prompt about ${tokens} tokens`);
    }
    return;
  }

  const results = [];
  for (const evalCase of cases) {
    const result = await evaluateCase(evalCase, config.minStoryScore, voice, async (prompt) => {
      const refusal = checkBudget(estimateTokens(prompt), provider.usdPerMillionTokens, config.budget);
      if (refusal) throw new Error(refusal);
      return callWithRetries(provider, prompt, config.budget.maxRetries);
    });
    results.push(result);
    console.log(`${result.name}: mode ${result.mode} (expected ${result.expectMode}), kept ${result.kept}/${result.produced}${result.error ? `, error: ${result.error}` : ""}`);
  }

  const summary = summarize(results);
  mkdirSync(EVAL_RESULTS, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  writeFileSync(join(EVAL_RESULTS, `${stamp}.json`), `${JSON.stringify({ model: provider.model, effort: provider.effort, summary, results }, null, 2)}\n`);
  console.log(`summary: ${JSON.stringify(summary)}`);
}

function readVoiceFolder(): string {
  if (!existsSync(VOICE_DIR)) return "";
  const files = [...new Bun.Glob("*.md").scanSync(VOICE_DIR)].sort();
  return files.map((file) => readFileSync(join(VOICE_DIR, file), "utf8")).join("\n\n");
}

async function loadVoice(config: Config): Promise<{ text: string; note: string }> {
  const folder = readVoiceFolder();
  const recalled = await recallFacts(runCommand, null, config.voiceTag);
  const facts = recalled.facts.map((fact) => fact.text);
  const text = [folder, ...facts].filter(Boolean).join("\n\n").slice(0, config.contextTokenBudget * 4);
  const failure = recalled.error ? `, recall failed: ${recalled.error}` : "";
  const note = `${facts.length} fact(s) tagged ${config.voiceTag} from agent-brain${failure}; voice folder ${folder ? "included" : "absent"}`;
  return { text, note };
}

async function callWithRetries(provider: Provider, prompt: string, retries: number): Promise<string> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await callAgent(provider, prompt);
    } catch (error) {
      if (attempt >= retries) throw error;
      await Bun.sleep(1000 * (attempt + 1));
    }
  }
}

async function hookMedia(args: string[]): Promise<void> {
  const date = flag(args, "--date") ?? today();
  const config = loadConfig(CONFIG);
  const commits = await loadCommits(join(ARCHIVE, date));
  const { selected } = select(commits, currentRules(config));
  const dir = join(DRAFTS, date, "media");
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });

  const source = selected.slice(0, 10).find((commit) => firstExcerpt(commit) !== null);
  const excerpt = source ? firstExcerpt(source) : null;
  if (!source || !excerpt) {
    writeFileSync(join(dir, "media.json"), `${JSON.stringify({ items: [], note: "No commit in the top ten has a clean diff excerpt." }, null, 2)}\n`);
    console.log(`no hook media for ${date}; see ${join(dir, "media.json")}`);
    return;
  }
  if (!excerptMatchesDiff(excerpt, source.diff)) {
    throw new Error(`excerpt from ${source.sha.slice(0, 7)} does not match its diff`);
  }

  const sha = source.sha.slice(0, 7);
  const alt = altText(excerpt, source);
  const items = [
    { file: `hook-tweet-${sha}.svg`, size: TWEET_SIZE },
    { file: `hook-blog-${sha}.svg`, size: BLOG_SIZE },
  ].map(({ file, size }) => {
    writeFileSync(join(dir, file), excerptCard(excerpt, source, size));
    return { file, alt, sha: source.sha, repo: source.repo, width: size.width, height: size.height };
  });
  writeFileSync(join(dir, "media.json"), `${JSON.stringify({ items, note: "Generated diff excerpt cards." }, null, 2)}\n`);
  console.log(`wrote ${items.length} hook card(s) for ${sha} into ${dir}`);
}

async function reviewDrafts(args: string[]): Promise<void> {
  const date = flag(args, "--date") ?? today();
  const reviewPath = draftPath(date, "review.md");
  const reviewText = existsSync(reviewPath) ? readFileSync(reviewPath, "utf8") : "";
  if (!existsSync(draftPath(date, "sources.json"))) {
    if (!reviewText) throw new Error(`no drafts for ${date}; run "shipnote draft --date ${date}" first`);
    console.log(reviewText);
    return;
  }

  const sources = JSON.parse(readFileSync(draftPath(date, "sources.json"), "utf8")) as {
    claims: Array<{
      item: string;
      text: string;
      commits: Array<{ sha: string; repo: string | null; subject: string | null; files: string[] }>;
    }>;
  };
  const approved = readApproved(draftPath(date, "approved.json"));

  for (const claim of sources.claims) {
    const [id] = draftIds([claim.item]);
    const length = claim.item.startsWith("tweet") ? ` (${claim.text.length}/${MAX_TWEET_CHARS} characters)` : "";
    console.log(`\n[${id}] ${approved.includes(id) ? "approved" : "not approved"}${length}`);
    console.log(claim.text);
    for (const commit of claim.commits) {
      console.log(`  evidence ${commit.sha.slice(0, 7)} ${commit.repo ?? "unknown repo"}: ${commit.subject ?? ""}`);
      for (const file of commit.files.slice(0, 5)) console.log(`    ${file}`);
    }
  }

  const rejected = reviewText.split("## Rejected")[1];
  if (rejected) console.log(`\n## Rejected${rejected.trimEnd()}`);
}

async function draftPosts(args: string[]): Promise<void> {
  const date = flag(args, "--date") ?? today();
  const top = Number(flag(args, "--top") ?? 5);
  const config = loadConfig(CONFIG);
  const provider = resolvedProvider(config);
  const commits = await loadCommits(join(ARCHIVE, date));
  const { selected, skipped } = select(commits, currentRules(config));
  const mode = chooseMode(selected[0]?.score, config.minStoryScore);
  const chosen = mode === "story" ? selected.slice(0, top) : selected.slice(0, THEME_EXAMPLES);
  const dir = join(DRAFTS, date);
  const info = { date, mode, model: provider.model, effort: provider.effort, selected: chosen.length, skipped: skipped.length };

  if (chosen.length === 0) {
    writeDrafts(dir, null, [], { ...info, error: "No commits passed selection, so there is nothing to draft." });
    console.log(`no commits to draft for ${date}; see ${join(dir, "review.md")}`);
    return;
  }

  const voice = await loadVoice(config);
  const prompt = buildPrompt(chosen, mode, voice.text);
  const tokens = estimateTokens(prompt);
  const cost = estimateCostUsd(tokens, provider.usdPerMillionTokens);
  const usage = `prompt about ${tokens} tokens and $${cost.toFixed(4)} (estimates; the agent CLI reports no usage)`;
  const runInfo = { ...info, usage, voice: voice.note };
  const refusal = checkBudget(tokens, provider.usdPerMillionTokens, config.budget);
  if (refusal) {
    writeDrafts(dir, null, chosen, { ...runInfo, error: `Budget check failed: ${refusal}. No agent call was made.` });
    console.log(`budget refused the draft; see ${join(dir, "review.md")}`);
    return;
  }

  let raw: string;
  try {
    raw = await callWithRetries(provider, prompt, config.budget.maxRetries);
  } catch (error) {
    writeDrafts(dir, null, chosen, { ...runInfo, error: `The agent call failed: ${(error as Error).message}` });
    console.log(`agent call failed; see ${join(dir, "review.md")}`);
    return;
  }

  let draft;
  try {
    draft = parseDraft(raw);
  } catch (error) {
    writeDrafts(dir, null, chosen, { ...runInfo, error: `The model output could not be parsed: ${(error as Error).message}` });
    console.log(`model output unreadable; see ${join(dir, "review.md")}`);
    return;
  }

  const result = check(mode === "theme" ? { ...draft, tweets: [] } : draft, chosen);
  writeDrafts(dir, result, chosen, runInfo);
  console.log(`${date}: ${result.draft.tweets.length} tweet(s), blog ${result.draft.blog ? "yes" : "no"}; see ${dir}`);
}

async function importArchive(args: string[]): Promise<void> {
  const source = args[0];
  if (!source) throw new Error("usage: shipnote import <dir> [--date YYYY-MM-DD]");
  const date = flag(args, "--date") ?? today();
  const destination = join(ARCHIVE, date);
  const copied = importPatches(source, destination);
  console.log(`imported ${copied.length} patch file(s) into ${destination}`);
}

async function rememberFact(args: string[]): Promise<void> {
  const [text] = positionals(args);
  if (!text) throw new Error('usage: shipnote remember "<text>" [--tag TAG] [--source SOURCE]');
  const tag = flag(args, "--tag") ?? loadConfig(CONFIG).voiceTag;
  const source = flag(args, "--source") ?? "manual";
  const stored = await storeFact(runCommand, text, tag, source);
  console.log(stored.deduplicated ? `already stored as ${stored.id}` : `stored ${stored.id}`);
}

async function importVoice(args: string[]): Promise<void> {
  const [dir = VOICE_DIR] = positionals(args);
  const report = await importCorpus(runCommand, dir, loadConfig(CONFIG).voiceTag);
  const refused = report.rejected_secret + report.rejected_too_long;
  console.log(`read ${report.paragraphs} paragraph(s) from ${report.files} file(s): stored ${report.stored}, already stored ${report.deduplicated}, refused ${refused}`);
}

const [command, ...args] = process.argv.slice(2);

const commands: Record<string, (args: string[]) => Promise<void>> = {
  fetch: fetchDataset,
  import: importArchive,
  remember: rememberFact,
  "import-voice": importVoice,
  select: selectCommits,
  draft: draftPosts,
  approve: approveDraft,
  "mark-used": markUsed,
  status: showStatus,
  review: reviewDrafts,
  media: hookMedia,
  "eval-add": evalAdd,
  eval: runEval,
};

if (!command || !commands[command]) {
  console.log("usage: shipnote <fetch|import|remember|import-voice|select|draft|media|review|approve|mark-used|status|eval-add|eval> [--date YYYY-MM-DD] [--run ID] [--top N]");
  process.exit(command ? 1 : 0);
}

try {
  await commands[command](args);
} catch (error) {
  console.error(`error: ${(error as Error).message}`);
  process.exit(1);
}
