import { fetchTickers, fetchH4Kline, fetchDailyKline, fetchOIHistory } from "$lib/api/bybit";
import { analyzeTrend, calculateEMA } from "$lib/analysis/trend";
import type { CoinAnalysis, OiSignal } from "$lib/types/market";
import type { EmaDir } from "$lib/analysis/trend";

const MIN_VOLUME = 10_000_000;
const MAX_VOLUME = 2_000_000_000;
const MIN_OI = 5_000_000;

function getOiSignal(oiChange: number, h4Change: number): OiSignal {
  if (Math.abs(oiChange) < 0.5) return "NEUTRAL";
  if (oiChange > 0 && h4Change > 0) return "LONGS_OPEN";
  if (oiChange > 0 && h4Change < 0) return "SHORTS_OPEN";
  if (oiChange < 0 && h4Change > 0) return "SHORTS_CLOSE";
  if (oiChange < 0 && h4Change < 0) return "LONGS_CLOSE";
  return "NEUTRAL";
}

export function tradeScore(
  ema20Dir: EmaDir,
  ema50Dir: EmaDir,
  dailyEmaDir: EmaDir,
  emaConverging: boolean,
  volVsAvg: number,
  oiSignal: OiSignal,
  oiChange: number,
  h4Change: number,
): number {
  let s = 0;

  // EMA alignment: both same direction = strong trend
  if (ema20Dir === ema50Dir && ema20Dir !== "FLAT") s += 3;
  else if (ema20Dir !== "FLAT") s += 1;

  // Daily EMA confirms H4 direction
  if (dailyEmaDir === ema20Dir && dailyEmaDir !== "FLAT") s += 2;

  // EMA converging = breakout imminent
  if (emaConverging) s += 1;

  // Volume vs average
  if (volVsAvg > 50) s += 3;
  else if (volVsAvg > 20) s += 2;
  else if (volVsAvg > 0) s += 1;

  // OI signal quality — real moves score higher
  if (oiSignal === "LONGS_OPEN" || oiSignal === "SHORTS_OPEN") s += Math.min(Math.abs(oiChange), 3);
  else if (oiSignal === "SHORTS_CLOSE" || oiSignal === "LONGS_CLOSE") s += 0.5;

  // H4 momentum magnitude
  s += Math.min(Math.abs(h4Change), 3);

  return Math.round(s * 100) / 100;
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
): string {
  const absFR = Math.abs(funding);
  const emaAligned = ema20Dir === ema50Dir && ema20Dir !== "FLAT";
  const volOk = volVsAvg > 0;
  const realOi = oiSignal === "LONGS_OPEN" || oiSignal === "SHORTS_OPEN";
  const frSafe = absFR < 0.01;
  const dailyMatch = dailyEmaDir === ema20Dir && dailyEmaDir !== "FLAT";
  const oiLabel = OI_LABELS[oiSignal];

  if (absFR >= 0.01) {
    return funding > 0
      ? "Longs overleveraged, funding too high — long squeeze risk"
      : "Shorts overleveraged, negative funding — short squeeze risk";
  }

  // Best case: H4 + Daily aligned + vol + real OI
  if (emaAligned && ema20Dir === "UP" && dailyMatch && volOk && realOi && h4Change > 0 && frSafe) {
    return `Daily+H4 aligned UP, ${oiLabel}, vol above avg, FR safe`;
  }
  if (emaAligned && ema20Dir === "DOWN" && dailyMatch && volOk && realOi && h4Change < 0 && frSafe) {
    return `Daily+H4 aligned DOWN, ${oiLabel}, vol above avg, FR safe`;
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

export async function scanMarket(): Promise<CoinAnalysis[]> {
  const tickers = await fetchTickers();
  const results: CoinAnalysis[] = [];

  const filtered = tickers
    .filter((t: any) => {
      if (!t.symbol.endsWith("USDT")) return false;
      const vol = Number(t.turnover24h);
      const oi = Number(t.openInterestValue);
      return vol >= MIN_VOLUME && vol <= MAX_VOLUME && oi >= MIN_OI;
    })
    .sort((a: any, b: any) => Number(b.turnover24h) - Number(a.turnover24h));

  for (const coin of filtered) {
    try {
      const symbol = coin.symbol;
      const [klines, dailyKlines, oiHistory] = await Promise.all([
        fetchH4Kline(symbol),
        fetchDailyKline(symbol),
        fetchOIHistory(symbol),
      ]);
      const closes = klines.map((k: any) => Number(k[4])).reverse();
      const volumes = klines.map((k: any) => Number(k[5])).reverse();

      if (closes.length < 2) continue;

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

      // Daily EMA direction
      const dailyCloses = dailyKlines.map((k: any) => Number(k[4])).reverse();
      const { ema20Dir: dailyEmaDir } = dailyCloses.length >= 21
        ? analyzeTrend(dailyCloses)
        : { ema20Dir: "FLAT" as EmaDir };

      const prev = closes[closes.length - 2];
      const curr = closes[closes.length - 1];
      const h4Change = ((curr - prev) / prev) * 100;
      const prevCandle = volumes.length - 2;
      const recentVols = volumes.slice(Math.max(0, prevCandle - 20), prevCandle);
      const avgVol = recentVols.reduce((a: number, b: number) => a + b, 0) / (recentVols.length || 1);
      const volVsAvg = avgVol > 0 ? ((volumes[prevCandle] - avgVol) / avgVol) * 100 : 0;

      let oiChange = 0;
      if (oiHistory.length >= 2) {
        const oiNow = Number(oiHistory[0].openInterest);
        const oiPrev = Number(oiHistory[1].openInterest);
        oiChange = ((oiNow - oiPrev) / oiPrev) * 100;
      }

      const oiSignal = getOiSignal(oiChange, h4Change);
      const score = tradeScore(ema20Dir, ema50Dir, dailyEmaDir, emaConverging, volVsAvg, oiSignal, oiChange, h4Change);
      const reason = detectReason(ema20Dir, ema50Dir, dailyEmaDir, emaConverging, volVsAvg, oiSignal, h4Change, funding);

      results.push({
        symbol, ema20Dir, ema50Dir, distEma20, distEma50, emaConverging, dailyEmaDir,
        volVsAvg, oiChange, oiSignal, h4Change, funding, score, reason,
      });
    } catch (err) {
      console.error(err);
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}
