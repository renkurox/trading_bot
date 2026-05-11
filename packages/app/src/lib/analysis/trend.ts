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

export type EmaDir = "UP" | "DOWN" | "FLAT";

function getDir(curr: number, prev: number): EmaDir {
  if (curr > prev) return "UP";
  if (curr < prev) return "DOWN";
  return "FLAT";
}

export interface TrendResult {
  ema20Dir: EmaDir;
  ema50Dir: EmaDir;
}

export type VolumeTrend = "RISING" | "FALLING" | "FLAT";

export interface VolumeTrendResult {
  volumeTrend: VolumeTrend;
  volEma20Dir: EmaDir;
  volEma50Dir: EmaDir;
}

export function analyzeVolumeTrend(
  volumes: number[]
): VolumeTrendResult {
  const volEma20 = calculateEMA(volumes, 20);
  const volEma50 = calculateEMA(volumes, 50);
  const prevVolEma20 = calculateEMA(volumes.slice(0, -1), 20);
  const prevVolEma50 = calculateEMA(volumes.slice(0, -1), 50);

  let volumeTrend: VolumeTrend = "FLAT";

  if (volEma20 > volEma50 * 1.05) {
    volumeTrend = "RISING";
  } else if (volEma20 < volEma50 * 0.95) {
    volumeTrend = "FALLING";
  }

  return {
    volumeTrend,
    volEma20Dir: getDir(volEma20, prevVolEma20),
    volEma50Dir: getDir(volEma50, prevVolEma50),
  };
}

export function analyzeTrend(
  closes: number[]
): TrendResult {

  const ema20 =
    calculateEMA(closes, 20);

  const ema50 =
    calculateEMA(closes, 50);

  const prevEma20 =
    calculateEMA(closes.slice(0, -1), 20);

  const prevEma50 =
    calculateEMA(closes.slice(0, -1), 50);

  return {
    ema20Dir: getDir(ema20, prevEma20),
    ema50Dir: getDir(ema50, prevEma50),
  };
}