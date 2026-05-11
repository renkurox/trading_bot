import type { Signal } from "$lib/analysis/flow";

export interface CoinAnalysis {
  symbol: string;
  price: number;
  volume24h: number;
  oi: number;
  oiChange: number;
  funding: number;
  trend: string;
  ema20: number;
  ema50: number;
  signal: Signal;
  state: string;
  score: number;
  h4Change: number;
  reason: string;
}