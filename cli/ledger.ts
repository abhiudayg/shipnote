import { existsSync, readFileSync, writeFileSync } from "node:fs";

const FULL_SHA = /^[0-9a-f]{40}$/;

export function validateShas(values: string[]): string[] {
  const invalid = values.find((value) => !FULL_SHA.test(value));
  if (invalid !== undefined) throw new Error(`not a full 40-character commit SHA: ${invalid}`);
  return values;
}

export function mergeLedger(ledger: string[], shas: string[]): string[] {
  return [...new Set([...ledger, ...shas])].sort();
}

export function releaseShas(ledger: string[], released: string[], stillApproved: string[]): string[] {
  const kept = new Set(stillApproved);
  const dropped = new Set(released.filter((sha) => !kept.has(sha)));
  return ledger.filter((sha) => !dropped.has(sha));
}

export function readLedger(path: string): string[] {
  if (!existsSync(path)) return [];
  const value: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new Error(`${path} must be a JSON array of commit SHAs`);
  }
  return value;
}

export function writeLedger(path: string, ledger: string[]): void {
  writeFileSync(path, `${JSON.stringify(ledger, null, 2)}\n`);
}
