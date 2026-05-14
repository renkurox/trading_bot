import { calculateEMA } from "./trend";

export interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// True Range: max(high-low, |high-prevClose|, |low-prevClose|)
function trueRange(candles: Candle[]): number[] {
  const tr: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const hl = candles[i].high - candles[i].low;
    const hc = Math.abs(candles[i].high - candles[i - 1].close);
    const lc = Math.abs(candles[i].low - candles[i - 1].close);
    tr.push(Math.max(hl, hc, lc));
  }
  return tr;
}

// ATR compression: ATR14 vs ATR50
export function atrCompression(candles: Candle[]): number {
  const tr = trueRange(candles);
  if (tr.length < 50) return 0;
  const atr14 = calculateEMA(tr.slice(-14), 14);
  const atr50 = calculateEMA(tr.slice(-50), 50);
  if (atr50 === 0) return 0;
  return atr14 / atr50;
}

// Bollinger Band Width: (upper - lower) / middle
export function bollingerBandWidth(closes: number[], period = 20): number {
  if (closes.length < period) return 0;
  const slice = closes.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
  const std = Math.sqrt(variance);
  if (mean === 0) return 0;
  return (2 * 2 * std) / mean; // 2x std for upper/lower
}

// Bollinger Band Width percentile over lookback
export function bbwPercentile(closes: number[], period = 20, lookback = 50): number {
  if (closes.length < period + lookback) return 0.5;
  const widths: number[] = [];
  for (let i = 0; i < lookback; i++) {
    const end = closes.length - i;
    widths.push(bollingerBandWidth(closes.slice(0, end), period));
  }
  const current = widths[0];
  const below = widths.filter(w => w < current).length;
  return below / widths.length;
}

// Candle range compression: avg range last 5 vs last 20
export function candleRangeCompression(candles: Candle[]): number {
  if (candles.length < 20) return 1;
  const last5 = candles.slice(-5);
  const last20 = candles.slice(-20);
  const avg5 = last5.reduce((a, c) => a + (c.high - c.low), 0) / 5;
  const avg20 = last20.reduce((a, c) => a + (c.high - c.low), 0) / 20;
  if (avg20 === 0) return 1;
  return avg5 / avg20;
}

export interface CompressionResult {
  atrRatio: number;       // ATR14/ATR50 — below 0.7 = compressed
  bbwPct: number;         // BBW percentile — below 0.2 = compressed
  rangeRatio: number;     // candle range ratio — below 0.7 = compressed
  compressionScore: number; // 0-100 weighted composite
  compressed: boolean;     // true if score > 60
}

export function analyzeCompression(candles: Candle[], closes: number[]): CompressionResult {
  const atrRatio = atrCompression(candles);
  const bbwPct = bbwPercentile(closes);
  const rangeRatio = candleRangeCompression(candles);

  // Score each: lower ratio = more compression = higher score
  const atrScore = atrRatio < 0.5 ? 100 : atrRatio < 0.7 ? 80 : atrRatio < 0.85 ? 40 : 0;
  const bbwScore = bbwPct < 0.1 ? 100 : bbwPct < 0.2 ? 80 : bbwPct < 0.35 ? 40 : 0;
  const rangeScore = rangeRatio < 0.5 ? 100 : rangeRatio < 0.7 ? 80 : rangeRatio < 0.85 ? 40 : 0;

  // Weighted: ATR 40%, BBW 40%, Range 20%
  const compressionScore = Math.round(atrScore * 0.4 + bbwScore * 0.4 + rangeScore * 0.2);

  return {
    atrRatio: Math.round(atrRatio * 1000) / 1000,
    bbwPct: Math.round(bbwPct * 1000) / 1000,
    rangeRatio: Math.round(rangeRatio * 1000) / 1000,
    compressionScore,
    compressed: compressionScore > 60,
  };
}
