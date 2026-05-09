import { describe, expect, it } from "vitest";
import { getReconnectDelayMs, shouldSwitchToFallback } from "./realtime-utils";

describe("realtime reconnect policy", () => {
  it("uses exponential backoff with cap", () => {
    expect(getReconnectDelayMs(0)).toBe(1000);
    expect(getReconnectDelayMs(1)).toBe(2000);
    expect(getReconnectDelayMs(2)).toBe(4000);
    expect(getReconnectDelayMs(10)).toBe(10000);
  });

  it("switches to fallback once max retries reached", () => {
    expect(shouldSwitchToFallback(4, 5)).toBe(false);
    expect(shouldSwitchToFallback(5, 5)).toBe(true);
  });
});
