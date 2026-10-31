import { describe, expect, test } from "bun:test";
import { findRepeat, overlap } from "./similarity";

describe("overlap", () => {
  test("scores a shorter restatement of a post as a repeat", () => {
    expect(overlap("Retries now run three times.", "Retries now run three times on failure.")).toBe(1);
  });

  test("scores an unrelated topic low", () => {
    expect(overlap("Dark mode ships for the dashboard.", "Retries now run three times on failure.")).toBe(0);
  });

  test("ignores stop words and very short words", () => {
    expect(overlap("the and for", "the and for")).toBe(0);
  });
});

describe("findRepeat", () => {
  const recent = [
    { date: "2026-10-20", id: "tweet-1", text: "Dark mode ships for the dashboard." },
    { date: "2026-10-30", id: "blog", text: "Retries now run three times on failure." },
  ];

  test("returns the recent post a draft repeats", () => {
    expect(findRepeat("Retries run three times.", recent)).toMatchObject({ date: "2026-10-30", id: "blog" });
  });

  test("returns null when nothing recent is similar", () => {
    expect(findRepeat("Exports now include CSV.", recent)).toBeNull();
  });
});
