export function formatCurrency(amount: number): string {
  return `PHP ${amount.toFixed(2)}`;
}

export function formatPercent(score: number): string {
  return `${Math.round(score)}%`;
}
