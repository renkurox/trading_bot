export function calculateEMA(
  prices: number[],
  period: number
): number {

  const k = 2 / (period + 1);

  let ema = prices[0];

  for (let i = 1; i < prices.length; i++) {

    ema =
      prices[i] * k +
      ema * (1 - k);
  }

  return ema;
}

export interface TrendResult {
  trend: string;
  ema20: number;
  ema50: number;
}

export function analyzeTrend(
  closes: number[]
): TrendResult {

  const ema20 =
    calculateEMA(closes, 20);

  const ema50 =
    calculateEMA(closes, 50);

  let trend = "RANGE";

  if (ema20 > ema50) {
    trend = "UPTREND";
  } else if (ema20 < ema50) {
    trend = "DOWNTREND";
  }

  return { trend, ema20, ema50 };
}