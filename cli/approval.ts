import { existsSync, readFileSync, writeFileSync } from "node:fs";

export function draftIds(items: string[]): string[] {
  return items.map((item) => item.replace(" ", "-"));
}

export function approve(approved: string[], id: string, ids: string[]): string[] {
  if (!ids.includes(id)) throw new Error(`no draft named ${id}; available: ${ids.join(", ")}`);
  return approved.includes(id) ? approved : [...approved, id];
}

export function readApproved(path: string): string[] {
  if (!existsSync(path)) return [];
  const value: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new Error(`${path} must be a JSON array of draft ids`);
  }
  return value;
}

export function writeApproved(path: string, approved: string[]): void {
  writeFileSync(path, `${JSON.stringify(approved, null, 2)}\n`);
}
