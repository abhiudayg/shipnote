import { describe, expect, test } from "bun:test";
import { bucketLabel, MIN_DECISIONS, tuningReport } from "./tune";

describe("bucketLabel", () => {
  test("places a word count in its length bucket", () => {
    expect(bucketLabel(15)).toBe("15 words or fewer");
    expect(bucketLabel(16)).toBe("16 to 20 words");
    expect(bucketLabel(26)).toBe("over 25 words");
  });
});

describe("tuningReport", () => {
  test("reports the count and withholds a suggestion below the minimum", () => {
    const report = tuningReport([{ words: 12, approved: true }]);
    expect(report).toContain(`need ${MIN_DECISIONS} before tuning`);
    expect(report).not.toContain("Suggestion");
  });

  test("suggests the opening length with the best approval rate once there is enough data", () => {
    const short = Array.from({ length: 10 }, () => ({ words: 12, approved: true }));
    const long = Array.from({ length: 10 }, (_, index) => ({ words: 22, approved: index < 2 }));
    expect(tuningReport([...short, ...long])).toContain('the best-approved opening length is "15 words or fewer"');
  });
});
