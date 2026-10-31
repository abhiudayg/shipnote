import { SECRET } from "./draft";
import type { Runner } from "./recall";

export type StoredFact = { id: string; deduplicated: boolean };

export type CorpusReport = {
  files: number;
  paragraphs: number;
  stored: number;
  deduplicated: number;
  rejected_secret: number;
  rejected_too_long: number;
};

export async function storeFact(run: Runner, text: string, tag: string, source: string): Promise<StoredFact> {
  if (SECRET.test(text)) throw new Error("text matches a secret pattern; nothing was stored");
  return JSON.parse(await run(["agent-brain", "remember", "--text", text, "--tag", tag, "--source", source])) as StoredFact;
}

export async function importCorpus(run: Runner, dir: string, tag: string): Promise<CorpusReport> {
  return JSON.parse(await run(["agent-brain", "import-corpus", dir, "--tag", tag])) as CorpusReport;
}
