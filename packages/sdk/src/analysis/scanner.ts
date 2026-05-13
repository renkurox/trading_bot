import { fetchTickers, fetchH4Kline, fetchDailyKline, fetchOIHistory } from "../api/bybit";
import { analyzeTrend, calculateEMA } from "../analysis/trend";
import type { CoinAnalysis, OiSignal, TradeType } from "../types/market";
import type { EmaDir } from "../analysis/trend";

const MIN_VOLUME = 10_000_000;
const MAX_VOLUME = 2_000_000_000;
const MIN_OI = 5_000_000;
const CONCURRENCY = 8;

function getOiSignal(oiChange: number, h4Change: number): OiSignal {
  if (Math.abs(oiChange) < 0.5) return "NEUTRAL";
  if (oiChange > 0 && h4Change > 0) return "LONGS_OPEN";
  if (oiChange > 0 && h4Change < 0) return "SHORTS_OPEN";
  if (oiChange < 0 && h4Change > 0) return "SHORTS_CLOSE";
  if (oiChange < 0 && h4Change < 0) return "LONGS_CLOSE";
  return "NEUTRAL";
}

function getTradeType(
  ema20Dir: EmaDir,
  ema50Dir: EmaDir,
  emaConverging: boolean,
  h4Change: number,
  priceSide: number,
): TradeType {
  const dir = ema20Dir === "UP" ? 1 : ema20Dir === "DOWN" ? -1 : 0;
  const aligned = ema20Dir === ema50Dir && ema20Dir !== "FLAT";
  const h4Matches = (dir > 0 && h4Change > 0) || (dir < 0 && h4Change < 0);
  // priceSide > 0 = price above EMA, < 0 = price below EMA
  const pullback = (dir > 0 && priceSide < 0) || (dir < 0 && priceSide > 0);

  if (emaConverging && !aligned) return "SQUEEZE";
  if (aligned && pullback) return "PULLBACK";
  if (aligned && h4Matches) return "CONTINUATION";
  if (aligned && !h4Matches) return "REVERSAL_RISK";
  return "UNCLEAR";
}

export function tradeScore(
  ema20Dir: EmaDir,
  ema50Dir: EmaDir,
  dailyEmaDir: EmaDir,
  dailyAligned: boolean,
  emaConverging: boolean,
  distEma20: number,
  distEma50: number,
  volVsAvg: number,
  oiSignal: OiSignal,
  oiChange: number,
  h4Change: number,
  funding: number,
): number {
  let s = 0;
  const dir = ema20Dir === "UP" ? 1 : ema20Dir === "DOWN" ? -1 : 0;
  const aligned = ema20Dir === ema50Dir && ema20Dir !== "FLAT";
  const dailyMatch = dailyEmaDir === ema20Dir && dailyEmaDir !== "FLAT";
  const counterTrend = aligned && dailyEmaDir !== "FLAT" && !dailyMatch;

  // EMA alignment: both same direction = strong trend
  if (aligned) s += 3;
  else if (ema20Dir !== "FLAT") s += 1;

  // Daily EMA confirms or conflicts
  if (dailyMatch && dailyAligned) s += 3;
  else if (dailyMatch) s += 2;
  else if (counterTrend) s -= 3;

  // EMA converging — only valuable when EMAs are not yet aligned
  if (emaConverging && !aligned && ema20Dir !== "FLAT") s += 1;

  // Entry quality: pullback to EMA (exclusive with distance bonus)
  const nearestEma = Math.min(Math.abs(distEma20), Math.abs(distEma50));
  const pullbackEntry =
    (dir > 0 && distEma20 < 0 && distEma20 > -2) ||
    (dir < 0 && distEma20 > 0 && distEma20 < 2);
  if (pullbackEntry) s += 2.5;
  else if (nearestEma < 0.3) s += 3;
  else if (nearestEma < 0.8) s += 2;
  else if (nearestEma < 1.5) s += 1;
  else if (nearestEma > 10) s -= 5;
  else if (nearestEma > 5) s -= 3;
  else if (nearestEma > 3) s -= 2;

  // Volume: continuous scale (0 to 3)
  if (volVsAvg > 0) s += Math.min(volVsAvg / 50, 3);

  // OI: reward if matches trend direction, penalize if against
  // Reduce OI credit when trading counter to daily
  const oiMatchesTrend =
    (dir > 0 && oiSignal === "LONGS_OPEN") ||
    (dir < 0 && oiSignal === "SHORTS_OPEN");
  const oiAgainstTrend =
    (dir > 0 && oiSignal === "SHORTS_OPEN") ||
    (dir < 0 && oiSignal === "LONGS_OPEN");
  const oiCredit = counterTrend ? 0.5 : 1;
  if (oiMatchesTrend) s += Math.min(Math.abs(oiChange), 3) * oiCredit;
  else if (oiSignal === "SHORTS_CLOSE" || oiSignal === "LONGS_CLOSE") s += 0.5;
  if (oiAgainstTrend) s -= 1;

  // H4 momentum: full credit if matches trend, small credit for pullback, none for FLAT
  if (dir !== 0) {
    const h4MatchesTrend = (dir > 0 && h4Change > 0) || (dir < 0 && h4Change < 0);
    if (h4MatchesTrend) s += Math.min(Math.abs(h4Change), 3);
    else s += Math.min(Math.abs(h4Change), 1);
  }

  // Funding rate penalty (abs > 0.0003 = 0.03% starts penalizing, > 0.001 = 0.1% heavy)
  const absFR = Math.abs(funding);
  if (absFR >= 0.001) s -= 3;
  else if (absFR >= 0.0005) s -= 1.5;
  else if (absFR >= 0.0003) s -= 0.5;

  return Math.round(s * 100) / 100;
}

async function runBatch<T, R>(items: T[], fn: (item: T) => Promise<R>, concurrency: number): Promise<R[]> {
  const results: R[] = [];
  let i = 0;
  async function next(): Promise<void> {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx]);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => next());
  await Promise.all(workers);
  return results;
}

const OI_LABELS: Record<OiSignal, string> = {
  LONGS_OPEN: "longs opening",
  SHORTS_OPEN: "shorts opening",
  SHORTS_CLOSE: "shorts closing (weak rally)",
  LONGS_CLOSE: "longs closing (weak dump)",
  NEUTRAL: "OI flat",
};

export function detectReason(
  ema20Dir: EmaDir,
  ema50Dir: EmaDir,
  dailyEmaDir: EmaDir,
  emaConverging: boolean,
  volVsAvg: number,
  oiSignal: OiSignal,
  h4Change: number,
  funding: number,
  distEma20 = 0,
): string {
  const absFR = Math.abs(funding);
  const emaAligned = ema20Dir === ema50Dir && ema20Dir !== "FLAT";
  const volOk = volVsAvg > 0;
  const realOi = oiSignal === "LONGS_OPEN" || oiSignal === "SHORTS_OPEN";
  const frSafe = absFR < 0.0003;
  const dailyMatch = dailyEmaDir === ema20Dir && dailyEmaDir !== "FLAT";
  const oiLabel = OI_LABELS[oiSignal];

  if (absFR >= 0.001) {
    return funding > 0
      ? "Longs overleveraged, funding too high — long squeeze risk"
      : "Shorts overleveraged, negative funding — short squeeze risk";
  }

  const absDist = Math.abs(distEma20);
  const entryNote = absDist < 0.5 ? ", at EMA" : absDist > 10 ? ", extremely extended — high reversal risk" : absDist > 5 ? ", overextended" : absDist > 3 ? ", extended" : "";

  // Best case: H4 + Daily aligned + vol + real OI
  if (emaAligned && ema20Dir === "UP" && dailyMatch && volOk && realOi && h4Change > 0 && frSafe) {
    return `Daily+H4 aligned UP, ${oiLabel}, vol above avg, FR safe${entryNote}`;
  }
  if (emaAligned && ema20Dir === "DOWN" && dailyMatch && volOk && realOi && h4Change < 0 && frSafe) {
    return `Daily+H4 aligned DOWN, ${oiLabel}, vol above avg, FR safe${entryNote}`;
  }

  // H4 aligned but counter-daily
  if (emaAligned && !dailyMatch && dailyEmaDir !== "FLAT") {
    return `H4 EMA ${ema20Dir} but Daily EMA ${dailyEmaDir} — counter-trend, higher risk`;
  }

  // H4 aligned + partial signals
  if (emaAligned && ema20Dir === "UP" && h4Change > 0) {
    if (!realOi) return `EMA UP + H4 green but ${oiLabel} — weak move`;
    if (!volOk) return "EMA UP + H4 green but vol below avg — weak conviction";
  }
  if (emaAligned && ema20Dir === "DOWN" && h4Change < 0) {
    if (!realOi) return `EMA DOWN + H4 red but ${oiLabel} — weak move`;
    if (!volOk) return "EMA DOWN + H4 red but vol below avg — weak conviction";
  }

  // EMA converging = squeeze
  if (emaConverging && ema20Dir !== ema50Dir) {
    return `EMA20/50 converging — breakout imminent, wait for direction`;
  }

  // Pullback/bounce
  if (emaAligned && ema20Dir === "UP" && h4Change < 0 && realOi) {
    return `Uptrend pullback, ${oiLabel} — dip buy zone`;
  }
  if (emaAligned && ema20Dir === "DOWN" && h4Change > 0 && realOi) {
    return `Downtrend bounce, ${oiLabel} — short zone`;
  }

  if (ema20Dir !== ema50Dir) {
    return emaConverging
      ? "EMA converging — squeeze building, no clear direction yet"
      : `EMA20 ${ema20Dir} vs EMA50 ${ema50Dir} — conflicting, no edge`;
  }

  return "No strong alignment between indicators";
}

async function analyzeCoin(coin: any): Promise<CoinAnalysis | null> {
  try {
    const symbol = coin.symbol;
    const [klines, dailyKlines, oiHistory] = await Promise.all([
      fetchH4Kline(symbol),
      fetchDailyKline(symbol),
      fetchOIHistory(symbol),
    ]);

    // Use only closed candles (skip last/current candle)
    const allCloses = klines.map((k: any) => Number(k[4])).reverse();
    const allVolumes = klines.map((k: any) => Number(k[5])).reverse();
    const closes = allCloses.slice(0, -1);
    const volumes = allVolumes.slice(0, -1);

    if (closes.length < 21) return null;

    const { ema20Dir, ema50Dir } = analyzeTrend(closes);
    const funding = Number(coin.fundingRate);
    const price = Number(coin.lastPrice);
    const ema20 = calculateEMA(closes, 20);
    const ema50 = calculateEMA(closes, 50);
    const prevEma20 = calculateEMA(closes.slice(0, -1), 20);
    const prevEma50 = calculateEMA(closes.slice(0, -1), 50);
    const distEma20 = ((price - ema20) / ema20) * 100;
    const distEma50 = ((price - ema50) / ema50) * 100;

    // EMA convergence: gap shrinking
    const gapNow = Math.abs(ema20 - ema50) / ema50 * 100;
    const gapPrev = Math.abs(prevEma20 - prevEma50) / prevEma50 * 100;
    const emaConverging = gapNow < gapPrev && gapNow < 1;

    // Daily EMA direction (both EMA20 and EMA50)
    const dailyCloses = dailyKlines.map((k: any) => Number(k[4])).reverse();
    const dailyTrend = dailyCloses.length >= 51
      ? analyzeTrend(dailyCloses)
      : dailyCloses.length >= 21
        ? { ema20Dir: analyzeTrend(dailyCloses).ema20Dir, ema50Dir: "FLAT" as EmaDir }
        : { ema20Dir: "FLAT" as EmaDir, ema50Dir: "FLAT" as EmaDir };
    const dailyEmaDir = dailyTrend.ema20Dir;
    const dailyAligned = dailyTrend.ema20Dir === dailyTrend.ema50Dir && dailyTrend.ema20Dir !== "FLAT";

    // H4 change: average of last 3 closed candles vs prior 3 (smooths single-candle noise)
    const recent3 = closes.slice(-3);
    const prior3 = closes.slice(-6, -3);
    const avgRecent = recent3.reduce((a: number, b: number) => a + b, 0) / recent3.length;
    const avgPrior = prior3.reduce((a: number, b: number) => a + b, 0) / prior3.length;
    const h4Change = ((avgRecent - avgPrior) / avgPrior) * 100;

    // Volume: average of last 3 closed candles vs average of prior 20
    const last3 = volumes.slice(-3);
    const prior20 = volumes.slice(-23, -3);
    const avgLast3 = last3.reduce((a: number, b: number) => a + b, 0) / last3.length;
    const avgPrior20 = prior20.length > 0
      ? prior20.reduce((a: number, b: number) => a + b, 0) / prior20.length
      : avgLast3;
    const volVsAvg = avgPrior20 > 0 ? ((avgLast3 - avgPrior20) / avgPrior20) * 100 : 0;

    // OI: average of last 2 vs average of prior 2 (fetch 4 data points)
    let oiChange = 0;
    if (oiHistory.length >= 4) {
      const oiRecent = (Number(oiHistory[0].openInterest) + Number(oiHistory[1].openInterest)) / 2;
      const oiPrior = (Number(oiHistory[2].openInterest) + Number(oiHistory[3].openInterest)) / 2;
      oiChange = ((oiRecent - oiPrior) / oiPrior) * 100;
    } else if (oiHistory.length >= 2) {
      const oiNow = Number(oiHistory[0].openInterest);
      const oiPrev = Number(oiHistory[1].openInterest);
      oiChange = ((oiNow - oiPrev) / oiPrev) * 100;
    }

    const oiSignal = getOiSignal(oiChange, h4Change);
    const score = tradeScore(ema20Dir, ema50Dir, dailyEmaDir, dailyAligned, emaConverging, distEma20, distEma50, volVsAvg, oiSignal, oiChange, h4Change, funding);
    const reason = detectReason(ema20Dir, ema50Dir, dailyEmaDir, emaConverging, volVsAvg, oiSignal, h4Change, funding, distEma20);
    const tradeType = getTradeType(ema20Dir, ema50Dir, emaConverging, h4Change, distEma20);

    return {
      symbol, ema20Dir, ema50Dir, distEma20, distEma50, emaConverging, dailyEmaDir, dailyAligned,
      volVsAvg, oiChange, oiSignal, h4Change, funding, score, reason, tradeType,
    };
  } catch (err) {
    console.error(err);
    return null;
  }
}

export async function scanMarket(limit = 0): Promise<CoinAnalysis[]> {
  const tickers = await fetchTickers();

  let filtered = tickers
    .filter((t: any) => {
      if (!t.symbol.endsWith("USDT")) return false;
      const vol = Number(t.turnover24h);
      const oi = Number(t.openInterestValue);
      return vol >= MIN_VOLUME && vol <= MAX_VOLUME && oi >= MIN_OI;
    })
    .sort((a: any, b: any) => Number(b.turnover24h) - Number(a.turnover24h));

  if (limit > 0) filtered = filtered.slice(0, limit);

  const results = await runBatch(filtered, analyzeCoin, CONCURRENCY);
  const valid = results.filter((r): r is CoinAnalysis => r !== null);
  valid.sort((a, b) => b.score - a.score);
  return valid;
}

