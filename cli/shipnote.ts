#!/usr/bin/env bun
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { approve, decisionFor, draftIds, readApproved, unapprove, writeApproved, type Decision } from "./approval";
import { importPatches } from "./archive";
import { importDocs } from "./docs";
import { checkBudget, estimateCostUsd, estimateTokens, type Budget } from "./budget";
import { altText, BLOG_SIZE, excerptCard, excerptMatchesDiff, firstExcerpt, TWEET_SIZE } from "./media";
import { evaluateCase, type EvalCase, summarize } from "./eval";
import { importCorpus, storeFact } from "./memory";
import { recallFacts, runCommand } from "./recall";
import { score } from "./select";
import { agentCommand, loadConfig, type Config, type Provider } from "./config";
import { mergeLedger, readLedger, validateShas, writeLedger } from "./ledger";
import { buildPrompt, check, chooseMode, type Draft, MAX_TWEET_CHARS, parseDraft, promptSha256 } from "./draft";
import { parsePatch, type Commit } from "./patch";
import { writeDrafts, writeFailure, type RunMeta } from "./output";
import { REPEAT_WINDOW_DAYS, type RecentPost } from "./similarity";
import { select, type Rules } from "./select";
import { withProgress } from "./progress";
import { commandHelp, type CommandSpec, rootHelp } from "./help";
import { debug, setVerbose } from "./log";
import { update } from "./update";
import pkg from "../package.json" with { type: "json" };

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
    used: new Set(readLedger(LEDGER)),
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
  debug(`downloading run ${runId} into ${dir}`);
  try {
    await withProgress(`downloading run ${runId}`, () => Bun.$`gh run download ${runId} --repo ${repo} --dir ${dir}`.quiet());
  } catch (error) {
    rmSync(dir, { recursive: true, force: true });
    throw error;
  }
  console.log(`archived run ${runId} to ${dir}`);
}

async function loadCommits(dir: string): Promise<Commit[]> {
  if (!existsSync(dir)) throw new Error(`no archive for this date: ${dir}. Run "shipnote fetch" first.`);
  return withProgress(`reading ${dir}`, async () => {
    const commits: Commit[] = [];
    for await (const file of new Bun.Glob("**/*.patch").scan(dir)) {
      const repoName = file.replace(/\.patch$/, "").split("/").slice(-2).join("/");
      commits.push(...parsePatch(readFileSync(join(dir, file), "utf8"), repoName));
    }
    debug(`read ${commits.length} commits from ${dir}`);
    return commits;
  });
}

const VALUE_FLAGS = ["--date", "--tag", "--source"];

function positionals(args: string[]): string[] {
  return args.filter((arg, index) => !arg.startsWith("--") && !(index > 0 && VALUE_FLAGS.includes(args[index - 1])));
}

function draftPath(date: string, file: string): string {
  return join(DRAFTS, date, file);
}

function claimItems(date: string): string[] {
  if (!existsSync(draftPath(date, "sources.json"))) throw new Error(`no drafts for ${date}; run "shipnote draft --date ${date}" first`);
  return readClaims(date).map((claim) => claim.item);
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

function stopAgentGroup(pid: number): void {
  try {
    process.kill(-pid, "SIGKILL");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
  }
}

async function callAgent(provider: Provider, prompt: string, timeoutSeconds: number): Promise<string> {
  const { argv, stdin } = agentCommand(provider, prompt);
  const proc = Bun.spawn(argv, {
    stdin: stdin === null ? "ignore" : new Blob([stdin]),
    stdout: "pipe",
    stderr: "pipe",
    detached: true,
  });
  debug(`agent ${provider.command} pid ${proc.pid}: prompt ${prompt.length} characters, timeout ${timeoutSeconds}s`);
  let timedOut = false;
  const stop = () => stopAgentGroup(proc.pid);
  const interrupt = () => {
    stop();
    process.exit(130);
  };
  const timer = setTimeout(() => {
    timedOut = true;
    stop();
  }, timeoutSeconds * 1000);
  process.once("SIGINT", interrupt);
  try {
    const [stdout, stderr, code] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    if (timedOut) throw new Error(`agent did not finish within ${timeoutSeconds}s`);
    if (code !== 0) throw new Error(`agent exited ${code}: ${stderr.trim()}`);
    return stdout;
  } finally {
    clearTimeout(timer);
    process.removeListener("SIGINT", interrupt);
  }
}

function configSha256(): string {
  return existsSync(CONFIG) ? createHash("sha256").update(readFileSync(CONFIG)).digest("hex") : "none";
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
  for (const [index, evalCase] of cases.entries()) {
    const result = await withProgress(`eval ${index + 1}/${cases.length} ${evalCase.name}`, () =>
      evaluateCase(evalCase, config.minStoryScore, voice, async (prompt) => {
        const refusal = checkBudget(estimateTokens(prompt), provider.usdPerMillionTokens, config.budget);
        if (refusal) throw new Error(refusal);
        return callWithRetries(provider, prompt, config.budget);
      }),
    );
    results.push(result);
    console.log(`${result.name}: mode ${result.mode} (expected ${result.expectMode}), kept ${result.kept}/${result.produced}${result.error ? `, error: ${result.error}` : ""}`);
  }

  const summary = summarize(results);
  mkdirSync(EVAL_RESULTS, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const versions = { promptSha256: promptSha256(), configSha256: configSha256() };
  writeFileSync(join(EVAL_RESULTS, `${stamp}.json`), `${JSON.stringify({ model: provider.model, effort: provider.effort, ...versions, summary, results }, null, 2)}\n`);
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

async function callWithRetries(provider: Provider, prompt: string, budget: Budget): Promise<string> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await callAgent(provider, prompt, budget.timeoutSeconds);
    } catch (error) {
      if (attempt >= budget.maxRetries) throw error;
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

  const approved = readApproved(draftPath(date, "approved.json"));
  for (const claim of readClaims(date)) printClaim(claim, approved);

  const rejected = reviewText.split("## Rejected")[1];
  if (rejected) console.log(`\n## Rejected${rejected.trimEnd()}`);
}

function printClaim(claim: Claim, approved: string[]): void {
  const [id] = draftIds([claim.item]);
  const length = claim.item.startsWith("tweet") ? ` (${claim.text.length}/${MAX_TWEET_CHARS} characters)` : "";
  console.log(`\n[${id}] ${approved.includes(id) ? "approved" : "not approved"}${length}`);
  console.log(claim.text);
  for (const commit of claim.commits) {
    console.log(`  evidence ${commit.sha.slice(0, 7)} ${commit.repo ?? "unknown repo"}: ${commit.subject ?? ""}`);
    for (const file of commit.files.slice(0, 5)) console.log(`    ${file}`);
  }
}

function readKey(): Promise<string> {
  return new Promise((resolve) => {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.once("data", (data) => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      resolve(data.toString());
    });
  });
}

async function decideDrafts(date: string): Promise<void> {
  if (!process.stdin.isTTY) throw new Error("review --decide needs an interactive terminal");
  const claims = readClaims(date);
  if (claims.length === 0) throw new Error(`no drafts for ${date}; run "shipnote draft --date ${date}" first`);
  const ids = draftIds(claims.map((claim) => claim.item));
  const path = draftPath(date, "approved.json");
  let approved = readApproved(path);

  for (const claim of claims) {
    const id = draftIds([claim.item])[0];
    printClaim(claim, approved);
    let decision: Decision | null = null;
    while (decision === null) {
      process.stdout.write("[a]pprove [r]eject [e]dit [s]kip [q]uit: ");
      const key = await readKey();
      console.log(key);
      if (key === "\u0003") return;
      decision = decisionFor(key);
    }
    if (decision === "quit") return;
    if (decision === "approve") {
      approved = approve(approved, id, ids);
      writeApproved(path, approved);
    }
    if (decision === "reject") {
      approved = unapprove(approved, id);
      writeApproved(path, approved);
    }
    if (decision === "edit") await editClaim(date, claim);
  }
  console.log(`approved for ${date}: ${approved.length > 0 ? approved.join(", ") : "none"}. Nothing was posted.`);
}

async function editClaim(date: string, claim: Claim): Promise<void> {
  const [command, ...flags] = (process.env.EDITOR ?? "vi").split(" ");
  const file = claim.item === "blog" ? "blog.md" : "tweets.md";
  await Bun.spawn([command, ...flags, draftPath(date, file)], { stdin: "inherit", stdout: "inherit", stderr: "inherit" }).exited;
}

async function showStats(): Promise<void> {
  const days = existsSync(DRAFTS) ? readdirSync(DRAFTS).filter(isDate) : [];
  let items = 0;
  let approvedItems = 0;
  for (const day of days) {
    const claims = readClaims(day);
    const approved = readApproved(draftPath(day, "approved.json"));
    items += claims.length;
    approvedItems += claims.filter((claim) => approved.includes(draftIds([claim.item])[0])).length;
  }
  const rate = items === 0 ? "n/a" : `${((approvedItems / items) * 100).toFixed(1)}%`;
  console.log(`${days.length} draft day(s), ${items} item(s), ${approvedItems} approved; approval rate ${rate}`);
}

type Claim = {
  item: string;
  text: string;
  commits: Array<{ sha: string; repo: string | null; subject: string | null; files: string[] }>;
};

function readClaims(date: string): Claim[] {
  const path = draftPath(date, "sources.json");
  if (!existsSync(path)) return [];
  return (JSON.parse(readFileSync(path, "utf8")) as { claims: Claim[] }).claims;
}

function isDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function shiftDays(date: string, days: number): string {
  const shifted = new Date(`${date}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

function recentPosts(date: string): RecentPost[] {
  if (!existsSync(DRAFTS)) return [];
  const cutoff = shiftDays(date, -REPEAT_WINDOW_DAYS);
  return readdirSync(DRAFTS)
    .filter((day) => isDate(day) && day >= cutoff && day < date)
    .flatMap((day) => {
      const approved = readApproved(draftPath(day, "approved.json"));
      return readClaims(day).flatMap((claim) => {
        const id = draftIds([claim.item])[0];
        return approved.includes(id) ? [{ date: day, id, text: claim.text }] : [];
      });
    });
}

async function draftPosts(args: string[]): Promise<void> {
  const date = flag(args, "--date") ?? today();
  const top = Number(flag(args, "--top") ?? 5);
  const config = loadConfig(CONFIG);
  const provider = resolvedProvider(config);
  const dir = join(DRAFTS, date);
  const started = performance.now();
  const runMeta = (estimatedTokens: number, estimatedCostUsd: number): RunMeta => ({
    model: provider.model,
    effort: provider.effort,
    promptSha256: promptSha256(),
    configSha256: configSha256(),
    durationMs: performance.now() - started,
    estimatedTokens,
    estimatedCostUsd,
  });
  const fail = (error: string, estimatedTokens = 0, estimatedCostUsd = 0): void => {
    writeFailure(dir, date, error, runMeta(estimatedTokens, estimatedCostUsd));
    console.log(`no drafts for ${date}; see ${join(dir, "review.md")}`);
  };

  let commits: Commit[];
  try {
    commits = await loadCommits(join(ARCHIVE, date));
  } catch (error) {
    fail(`The dataset could not be loaded: ${(error as Error).message}`);
    return;
  }
  const { selected, skipped } = select(commits, currentRules(config));
  const mode = chooseMode(selected[0]?.score, config.minStoryScore);
  const chosen = mode === "story" ? selected.slice(0, top) : selected.slice(0, THEME_EXAMPLES);
  debug(`mode ${mode}: drafting ${chosen.length} of ${selected.length} selected commits`);
  if (chosen.length === 0) {
    fail("No commits passed selection, so there is nothing to draft.");
    return;
  }

  const voice = await loadVoice(config);
  const prompt = buildPrompt(chosen, mode, voice.text);
  const tokens = estimateTokens(prompt);
  const cost = estimateCostUsd(tokens, provider.usdPerMillionTokens);
  const usage = `prompt about ${tokens} tokens and $${cost.toFixed(4)} (estimates; the agent CLI reports no usage)`;
  const refusal = checkBudget(tokens, provider.usdPerMillionTokens, config.budget);
  if (refusal) {
    fail(`Budget check failed: ${refusal}. No agent call was made.`, tokens, cost);
    return;
  }

  let raw: string;
  try {
    raw = await withProgress(`drafting with ${provider.command} (${provider.model})`, () => callWithRetries(provider, prompt, config.budget));
  } catch (error) {
    fail(`The agent call failed: ${(error as Error).message}`, tokens, cost);
    return;
  }

  let draft: Draft;
  try {
    draft = parseDraft(raw);
  } catch (error) {
    fail(`The model output could not be parsed: ${(error as Error).message}`, tokens, cost);
    return;
  }

  const result = check(mode === "theme" ? { ...draft, tweets: [] } : draft, chosen, recentPosts(date));
  if (result.draft.tweets.length === 0 && !result.draft.blog) {
    const reasons = result.rejections.map((r) => `${r.item}: ${r.reason}`).join("; ");
    fail(`No draft passed validation, so none was written. Rejected: ${reasons}`, tokens, cost);
    return;
  }
  writeDrafts(dir, result, chosen, {
    date,
    mode,
    selected: chosen.length,
    skipped: skipped.length,
    usage,
    voice: voice.note,
    meta: runMeta(tokens, cost),
  });
  console.log(`${date}: ${result.draft.tweets.length} tweet(s), blog ${result.draft.blog ? "yes" : "no"}; see ${dir}`);
  console.log(readFileSync(join(dir, "tweets.md"), "utf8"));
}

async function importArchive(args: string[]): Promise<void> {
  const source = args[0];
  if (!source) throw new Error("usage: shipnote import <dir> [--date YYYY-MM-DD]");
  const date = flag(args, "--date") ?? today();
  const destination = join(ARCHIVE, date);
  const copied = importPatches(source, destination);
  console.log(`imported ${copied.length} patch file(s) into ${destination}`);
}

async function importDocuments(args: string[]): Promise<void> {
  const source = args[0];
  if (!source) throw new Error("usage: shipnote import-docs <dir> [--date YYYY-MM-DD]");
  const date = flag(args, "--date") ?? today();
  const copied = importDocs(source, join(ARCHIVE, date));
  console.log(`imported ${copied.length} document(s) into ${join(ARCHIVE, date, "docs")}`);
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
  const report = await withProgress(`importing ${dir}`, () => importCorpus(runCommand, dir, loadConfig(CONFIG).voiceTag));
  const refused = report.rejected_secret + report.rejected_too_long;
  console.log(`read ${report.paragraphs} paragraph(s) from ${report.files} file(s): stored ${report.stored}, already stored ${report.deduplicated}, refused ${refused}`);
}

const COMMANDS: Record<string, CommandSpec & { run: (args: string[]) => Promise<void> }> = {
  fetch: {
    summary: "Download the nightly dataset for a date",
    usage: "fetch [--date YYYY-MM-DD] [--run ID]",
    options: [
      ["--date YYYY-MM-DD", "Day to fetch (default: today in IST)"],
      ["--run ID", "Workflow run to download (default: latest successful)"],
    ],
    run: fetchDataset,
  },
  import: {
    summary: "Import exported patch files from a folder",
    usage: "import <dir> [--date YYYY-MM-DD]",
    options: [["--date YYYY-MM-DD", "Day to store the patches under (default: today in IST)"]],
    run: importArchive,
  },
  "import-docs": {
    summary: "Import a folder of markdown documents as drafting sources",
    usage: "import-docs <dir> [--date YYYY-MM-DD]",
    options: [["--date YYYY-MM-DD", "Day to store the documents under (default: today in IST)"]],
    run: importDocuments,
  },
  remember: {
    summary: "Store one voice fact in agent-brain",
    usage: 'remember "<text>" [--tag TAG] [--source SOURCE]',
    options: [
      ["--tag TAG", "Tag for the fact (default: voice_tag)"],
      ["--source SOURCE", "Where the text came from (default: manual)"],
    ],
    run: rememberFact,
  },
  "import-voice": {
    summary: "Store each paragraph of a voice folder in agent-brain",
    usage: "import-voice [dir]",
    options: [],
    run: importVoice,
  },
  select: {
    summary: "Rank the commits worth a post for a date",
    usage: "select [--date YYYY-MM-DD]",
    options: [["--date YYYY-MM-DD", "Day to rank (default: today in IST)"]],
    run: selectCommits,
  },
  draft: {
    summary: "Draft tweets and a blog post from the selected commits",
    usage: "draft [--date YYYY-MM-DD] [--top N]",
    options: [
      ["--date YYYY-MM-DD", "Day to draft (default: today in IST)"],
      ["--top N", "Commits to draft from in story mode (default: 5)"],
    ],
    run: draftPosts,
  },
  media: {
    summary: "Render diff excerpt cards for the top commits",
    usage: "media [--date YYYY-MM-DD]",
    options: [["--date YYYY-MM-DD", "Day to render (default: today in IST)"]],
    run: hookMedia,
  },
  review: {
    summary: "Show drafts beside their evidence, or step through them",
    usage: "review [--date YYYY-MM-DD] [--decide]",
    options: [
      ["--date YYYY-MM-DD", "Day to review (default: today in IST)"],
      ["--decide", "Approve, reject, edit, or skip each draft with one key"],
    ],
    run: (args) => (args.includes("--decide") ? decideDrafts(flag(args, "--date") ?? today()) : reviewDrafts(args)),
  },
  approve: {
    summary: "Approve one draft; nothing is posted",
    usage: "approve <draft-id> [--date YYYY-MM-DD]",
    options: [["--date YYYY-MM-DD", "Day the draft belongs to (default: today in IST)"]],
    run: approveDraft,
  },
  "mark-used": {
    summary: "Mark commits as used so select skips them",
    usage: "mark-used <sha> [<sha> ...]",
    options: [],
    run: markUsed,
  },
  status: {
    summary: "Show a day's drafts and approvals",
    usage: "status [--date YYYY-MM-DD]",
    options: [["--date YYYY-MM-DD", "Day to show (default: today in IST)"]],
    run: showStatus,
  },
  stats: {
    summary: "Report the approval rate across all draft days",
    usage: "stats",
    options: [],
    run: showStats,
  },
  "eval-add": {
    summary: "Save a commit case for the eval set",
    usage: "eval-add <name> --date YYYY-MM-DD --sha SHA[,SHA] --expect story|theme --notes TEXT",
    options: [
      ["--date YYYY-MM-DD", "Archive day the commits come from"],
      ["--sha SHA[,SHA]", "Commit SHA prefixes to include"],
      ["--expect story|theme", "Mode the case should produce"],
      ["--notes TEXT", "What a good post should say"],
    ],
    run: evalAdd,
  },
  update: {
    summary: "Install the latest shipnote from npm, or check for it",
    usage: "update [--check]",
    options: [["--check", "Only report whether a newer version exists"]],
    run: async (args) => console.log(await update(pkg.version, args.includes("--check"))),
  },
  eval: {
    summary: "Run the saved eval cases through the agent",
    usage: "eval [--dry-run]",
    options: [["--dry-run", "Print prompt sizes without calling the agent"]],
    run: runEval,
  },
};

const argv = process.argv.slice(2);
setVerbose(argv.includes("-v") || argv.includes("--verbose"));
const [command, ...args] = argv.filter((arg) => arg !== "-v" && arg !== "--verbose");

if (argv.includes("--version")) {
  console.log(pkg.version);
  process.exit(0);
}

if (!command || command === "-h" || command === "--help") {
  console.log(rootHelp(pkg.version, COMMANDS));
  process.exit(0);
}

const spec = COMMANDS[command];
if (!spec) {
  console.error(`shipnote: '${command}' is not a shipnote command. See 'shipnote --help'.`);
  process.exit(1);
}

if (args.includes("-h") || args.includes("--help")) {
  console.log(commandHelp(spec));
  process.exit(0);
}

debug(`command ${command} ${args.join(" ")}`);
try {
  await spec.run(args);
} catch (error) {
  console.error(`error: ${(error as Error).message}`);
  process.exit(1);
}
