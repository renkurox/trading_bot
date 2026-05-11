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
  volume: number,
): FlowResult {
  const absFunding = Math.abs(funding);
  const volScore = Math.min(Math.log10(volume / 1_000_000 + 1) * 2, 10);

  // OI rising = new positions opening, OI dropping = positions closing
  const oiRising = oiChange > 1;
  const oiDropping = oiChange < -1;

  let signal: Signal = "SKIP";
  let state = "NEUTRAL";
  let reason = "";
  let score = 0;

  // LONG: uptrend + price rising + OI rising + funding not overheated
  if (trend === "UPTREND" && h4Change > 0 && oiRising && absFunding < 0.01) {
    signal = "LONG";
    state = "LONG_FLOW";
    reason = "Uptrend + new longs entering";
    score = h4Change * 0.3 + oiChange * 0.4 + volScore * 0.3;
  }
  // SHORT: downtrend + price falling + OI rising + funding not overheated
  else if (trend === "DOWNTREND" && h4Change < 0 && oiRising && absFunding < 0.01) {
    signal = "SHORT";
    state = "SHORT_FLOW";
    reason = "Downtrend + new shorts entering";
    score = Math.abs(h4Change) * 0.3 + oiChange * 0.4 + volScore * 0.3;
  }
  // Strong long momentum with big move
  else if (h4Change > 2 && oiRising) {
    signal = "LONG";
    state = "STRONG_LONG";
    reason = "Strong H4 pump + OI rising";
    score = h4Change * 0.4 + oiChange * 0.3 + volScore * 0.3;
  }
  // Strong short momentum with big move
  else if (h4Change < -2 && oiRising) {
    signal = "SHORT";
    state = "STRONG_SHORT";
    reason = "Strong H4 dump + OI rising";
    score = Math.abs(h4Change) * 0.4 + oiChange * 0.3 + volScore * 0.3;
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