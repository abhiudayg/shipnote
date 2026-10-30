export type Budget = {
  maxTokens: number;
  maxCostUsd: number;
  maxRetries: number;
};

export const DEFAULT_BUDGET: Budget = {
  maxTokens: 200000,
  maxCostUsd: 1,
  maxRetries: 2,
};

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function estimateCostUsd(tokens: number, usdPerMillionTokens: number): number {
  return (tokens / 1_000_000) * usdPerMillionTokens;
}

export function checkBudget(tokens: number, usdPerMillionTokens: number, budget: Budget): string | null {
  if (tokens > budget.maxTokens) {
    return `prompt is about ${tokens} tokens, over the ${budget.maxTokens} token limit`;
  }
  const cost = estimateCostUsd(tokens, usdPerMillionTokens);
  if (cost > budget.maxCostUsd) {
    return `estimated cost $${cost.toFixed(4)} is over the $${budget.maxCostUsd} limit`;
  }
  return null;
}
