import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import type { Checked } from "./draft";
import { linkedinPost } from "./platforms";
import { parsePatch } from "./patch";

const commits = parsePatch(readFileSync(new URL("./fixtures/sample.patch", import.meta.url), "utf8"), "abhiudayg/dustmap");
const retrySha = "1111111111111111111111111111111111111111";
const blog = { title: "Retry", summary: "Retries now back off.", body: "word", shas: [retrySha] };

describe("linkedinPost", () => {
  test("uses the blog title and summary with a link to each cited commit", () => {
    const checked: Checked = { draft: { tweets: [], blog }, rejections: [] };
    expect(linkedinPost(checked, commits)).toBe(
      "Retry\n\nRetries now back off.\n\nhttps://github.com/abhiudayg/dustmap/commit/1111111111111111111111111111111111111111",
    );
  });

  test("falls back to the first tweet when there is no blog", () => {
    const checked: Checked = { draft: { tweets: [{ text: "Retries now run.", shas: [retrySha] }], blog: null }, rejections: [] };
    expect(linkedinPost(checked, commits)).toMatch(/^Retries now run\.\n\nhttps:\/\/github\.com\//);
  });

  test("returns null when nothing passed validation", () => {
    expect(linkedinPost({ draft: { tweets: [], blog: null }, rejections: [] }, commits)).toBeNull();
  });
});
