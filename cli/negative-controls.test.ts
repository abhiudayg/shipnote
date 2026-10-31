import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { check } from "./draft";
import { parsePatch } from "./patch";

type Control = { text: string; shas: string[]; expect: "reject" | "keep"; note: string };

const commits = parsePatch(readFileSync(new URL("./fixtures/sample.patch", import.meta.url), "utf8"), "abhiudayg/dustmap");
const controls: Control[] = JSON.parse(readFileSync(new URL("./fixtures/negative-controls.json", import.meta.url), "utf8"));

describe("negative controls", () => {
  for (const control of controls) {
    test(`${control.expect}: ${control.note}`, () => {
      const kept = check({ tweets: [{ text: control.text, shas: control.shas }], blog: null }, commits).draft.tweets.length;
      expect(kept).toBe(control.expect === "keep" ? 1 : 0);
    });
  }
});
