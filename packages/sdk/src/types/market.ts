import type { EmaDir } from "../analysis/trend";

export type OiSignal = "LONGS_OPEN" | "SHORTS_OPEN" | "SHORTS_CLOSE" | "LONGS_CLOSE" | "NEUTRAL";
export type TradeType = "CONTINUATION" | "PULLBACK" | "SQUEEZE" | "REVERSAL_RISK" | "UNCLEAR";

export interface CoinAnalysis {
  symbol: string;
  ema20Dir: EmaDir;
  ema50Dir: EmaDir;
  distEma20: number;
  distEma50: number;
  emaConverging: boolean;
  dailyEmaDir: EmaDir;
  dailyAligned: boolean;
  volVsAvg: number;
  oiChange: number;
  oiSignal: OiSignal;
  h4Change: number;
  funding: number;
  score: number;
  reason: string;
  tradeType: TradeType;
}
