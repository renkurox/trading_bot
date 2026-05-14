import type { EmaDir } from "../analysis/trend";

export type OiSignal = "LONGS_OPEN" | "SHORTS_OPEN" | "SHORTS_CLOSE" | "LONGS_CLOSE" | "NEUTRAL";
export type MarketPhase = "CONTINUATION" | "EARLY_BREAKOUT" | "VOLATILITY_EXPANSION" | "EXHAUSTION" | "REVERSAL_RISK" | "UNCLEAR";
export type MomentumClass = "WEAK" | "MODERATE" | "STRONG" | "EXPANSION";
export type Category = "A" | "B" | "C";

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
  oiMomentum: number;
  oiSignal: OiSignal;
  h4Change: number;
  momentum: MomentumClass;
  funding: number;
  compressionScore: number;
  compressed: boolean;
  confirmationScore: number;
  potentialScore: number;
  score: number;
  reason: string;
  phase: MarketPhase;
  category: Category;
}
