import { cpSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

export function importPatches(source: string, destination: string): string[] {
  const copied: string[] = [];
  for (const file of new Bun.Glob("**/*.patch").scanSync(source)) {
    if (file.split("/").length < 2) {
      throw new Error(`expected <owner>/<repo>.patch, found ${file}`);
    }
    const target = join(destination, file);
    mkdirSync(dirname(target), { recursive: true });
    cpSync(join(source, file), target);
    copied.push(file);
  }
  if (copied.length === 0) throw new Error(`no .patch files found under ${source}`);
  return copied;
}
