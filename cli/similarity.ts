export type RecentPost = { date: string; id: string; text: string };

export const REPEAT_WINDOW_DAYS = 30;
export const REPEAT_OVERLAP = 0.6;

const STOP_WORDS = new Set([
  "about", "also", "and", "are", "but", "can", "for", "from", "has", "have", "into", "its", "just", "not",
  "now", "that", "the", "their", "them", "then", "this", "was", "were", "when", "will", "with", "you", "your",
]);

export function tokens(text: string): Set<string> {
  const words = text.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [];
  return new Set(words.filter((word) => !STOP_WORDS.has(word)));
}

export function overlap(a: string, b: string): number {
  const left = tokens(a);
  const right = tokens(b);
  if (left.size === 0 || right.size === 0) return 0;
  const shared = [...left].filter((word) => right.has(word)).length;
  return shared / Math.min(left.size, right.size);
}

export function findRepeat(text: string, recent: RecentPost[]): RecentPost | null {
  return recent.find((post) => overlap(text, post.text) >= REPEAT_OVERLAP) ?? null;
}
