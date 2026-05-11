import type { VolumeTrend } from "$lib/analysis/trend";

export type Signal = "LONG" | "SHORT" | "SKIP";

export interface FlowResult {
  signal: Signal;
  state: string;
  score: number;
  reason: string;
}

export function analyzeFlow(
  trend: string,
  h4Change: number,
  oiChange: number,
  funding: number,
  volumeTrend: VolumeTrend,
): FlowResult {
  const absFunding = Math.abs(funding);
  const volBoost = volumeTrend === "RISING" ? 1.5 : volumeTrend === "FLAT" ? 1.0 : 0.5;

  // OI rising = new positions opening, OI dropping = positions closing
  const oiRising = oiChange > 1;
  const oiDropping = oiChange < -1;

  let signal: Signal = "SKIP";
  let state = "NEUTRAL";
  let reason = "";
  let score = 0;

  // LONG: uptrend + price rising + OI rising + volume confirming + funding not overheated
  if (trend === "UPTREND" && h4Change > 0 && oiRising && volumeTrend !== "FALLING" && absFunding < 0.01) {
    signal = "LONG";
    state = "LONG_FLOW";
    reason = `Uptrend + new longs + vol ${volumeTrend}`;
    score = (h4Change * 0.3 + oiChange * 0.4 + 3 * 0.3) * volBoost;
  }
  // SHORT: downtrend + price falling + OI rising + volume confirming + funding not overheated
  else if (trend === "DOWNTREND" && h4Change < 0 && oiRising && volumeTrend !== "FALLING" && absFunding < 0.01) {
    signal = "SHORT";
    state = "SHORT_FLOW";
    reason = `Downtrend + new shorts + vol ${volumeTrend}`;
    score = (Math.abs(h4Change) * 0.3 + oiChange * 0.4 + 3 * 0.3) * volBoost;
  }
  // Strong long momentum with big move + volume rising
  else if (h4Change > 2 && oiRising && volumeTrend === "RISING") {
    signal = "LONG";
    state = "STRONG_LONG";
    reason = "Strong H4 pump + OI rising + vol RISING";
    score = (h4Change * 0.4 + oiChange * 0.3 + 3 * 0.3) * volBoost;
  }
  // Strong short momentum with big move + volume rising
  else if (h4Change < -2 && oiRising && volumeTrend === "RISING") {
    signal = "SHORT";
    state = "STRONG_SHORT";
    reason = "Strong H4 dump + OI rising + vol RISING";
    score = (Math.abs(h4Change) * 0.4 + oiChange * 0.3 + 3 * 0.3) * volBoost;
  }
  // Volume falling = low conviction, skip
  else if (volumeTrend === "FALLING") {
    state = "LOW_VOLUME";
    reason = "Volume EMA declining";
  }
  // OI dropping = positions closing, avoid
  else if (oiDropping) {
    state = "CLOSING";
    reason = "Positions closing";
  }
  // Overheated funding
  else if (absFunding >= 0.01) {
    state = "OVERHEATED";
    reason = "Funding rate too high";
  }
  else {
    reason = "No clear setup";
  }

  return { signal, state, score, reason };
}