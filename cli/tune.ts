export type Sample = { words: number; approved: boolean };

export const MIN_DECISIONS = 20;

const BUCKETS: Array<{ label: string; max: number }> = [
  { label: "15 words or fewer", max: 15 },
  { label: "16 to 20 words", max: 20 },
  { label: "21 to 25 words", max: 25 },
  { label: "over 25 words", max: Infinity },
];

export function bucketLabel(words: number): string {
  return (BUCKETS.find((bucket) => words <= bucket.max) ?? BUCKETS[BUCKETS.length - 1]).label;
}

export function tuningReport(samples: Sample[]): string {
  const lines = [`Decisions on tweets: ${samples.length} (need ${MIN_DECISIONS} before tuning is suggested).`];
  for (const bucket of BUCKETS) {
    const inBucket = samples.filter((sample) => bucketLabel(sample.words) === bucket.label);
    const approved = inBucket.filter((sample) => sample.approved).length;
    const rate = inBucket.length === 0 ? "no decisions" : `${Math.round((approved / inBucket.length) * 100)}% approved`;
    lines.push(`- ${bucket.label}: ${inBucket.length} decision(s), ${rate}`);
  }
  if (samples.length < MIN_DECISIONS) return lines.join("\n");
  const rates = BUCKETS.map((bucket) => {
    const inBucket = samples.filter((sample) => bucketLabel(sample.words) === bucket.label);
    return { label: bucket.label, rate: inBucket.length === 0 ? -1 : inBucket.filter((sample) => sample.approved).length / inBucket.length };
  });
  const best = rates.reduce((top, row) => (row.rate > top.rate ? row : top));
  lines.push(`Suggestion: the best-approved opening length is "${best.label}". Change MAX_FIRST_SENTENCE_WORDS only if this holds across more decisions.`);
  return lines.join("\n");
}
