import { describe, expect, test } from "bun:test";
import { withProgress } from "./progress";

async function captureStderr(run: () => Promise<unknown>): Promise<string> {
  const writes: string[] = [];
  const original = process.stderr.write;
  process.stderr.write = (chunk: string | Uint8Array) => {
    writes.push(String(chunk));
    return true;
  };
  try {
    await run();
  } finally {
    process.stderr.write = original;
  }
  return writes.join("");
}

describe("withProgress", () => {
  test("returns the value of the task", async () => {
    expect(await withProgress("reading", async () => 42)).toBe(42);
  });

  test("passes the task's error through", async () => {
    await expect(
      withProgress("drafting", async () => {
        throw new Error("agent exited 1");
      }),
    ).rejects.toThrow("agent exited 1");
  });

  test("writes nothing for a task that finishes quickly", async () => {
    expect(await captureStderr(() => withProgress("reading", async () => 1))).toBe("");
  });

  test("shows the label once a task runs longer than a second", async () => {
    const output = await captureStderr(() => withProgress("drafting", () => Bun.sleep(1200)));
    expect(output).toContain("drafting");
    expect(output).toContain("✓ drafting");
  });
});
