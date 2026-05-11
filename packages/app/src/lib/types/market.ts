import type { VolumeTrend, EmaDir } from "$lib/analysis/trend";

export interface CoinAnalysis {
  symbol: string;
  ema20Dir: EmaDir;
  ema50Dir: EmaDir;
  volumeTrend: VolumeTrend;
  volEma20Dir: EmaDir;
  volEma50Dir: EmaDir;
  oiChange: number;
  h4Change: number;
  funding: number;
  score: number;
  reason: string;
}