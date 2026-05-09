export function getReconnectDelayMs(attempt: number): number {
  return Math.min(10000, 1000 * 2 ** Math.max(0, attempt));
}

export function shouldSwitchToFallback(attempt: number, maxAttempts = 5): boolean {
  return attempt >= maxAttempts;
}
