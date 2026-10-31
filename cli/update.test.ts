import { describe, expect, test } from "bun:test";
import { isNewer } from "./update";

describe("isNewer", () => {
  test("a higher minor version is newer", () => {
    expect(isNewer("0.3.0", "0.2.1")).toBe(true);
  });

  test("an older version is not newer", () => {
    expect(isNewer("0.2.1", "0.3.0")).toBe(false);
  });

  test("the same version is not newer", () => {
    expect(isNewer("0.3.0", "0.3.0")).toBe(false);
  });

  test("compares numbers, not text", () => {
    expect(isNewer("0.10.0", "0.9.0")).toBe(true);
  });

  test("a higher major version is newer", () => {
    expect(isNewer("1.0.0", "0.9.9")).toBe(true);
  });
});
