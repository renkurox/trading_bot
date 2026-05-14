import { fetchTickers, fetchH4Kline, fetchDailyKline, fetchOIHistory } from "../api/bybit";
import { analyzeTrend, calculateEMA } from "../analysis/trend";
import { analyzeCompression } from "../analysis/volatility";
import type { Candle } from "../analysis/volatility";
import type { CoinAnalysis, OiSignal, MarketPhase, MomentumClass, Category } from "../types/market";
import type { EmaDir } from "../analysis/trend";

const MIN_VOLUME = 10_000_000;
const MAX_VOLUME = 2_000_000_000;
const MIN_OI = 5_000_000;
const CONCURRENCY = 8;

// --- Helpers ---

function round(n: number, d = 2): number {
  return Math.round(n * 10 ** d) / 10 ** d;
}

function getOiSignal(oiChange: number, h4Change: number): OiSignal {
  if (Math.abs(oiChange) < 0.5) return "NEUTRAL";
  if (oiChange > 0 && h4Change > 0) return "LONGS_OPEN";
  if (oiChange > 0 && h4Change < 0) return "SHORTS_OPEN";
  if (oiChange < 0 && h4Change > 0) return "SHORTS_CLOSE";
  if (oiChange < 0 && h4Change < 0) return "LONGS_CLOSE";
  return "NEUTRAL";
}

function classifyMomentum(h4Change: number): MomentumClass {
  const abs = Math.abs(h4Change);
  if (abs < 0.3) return "WEAK";
  if (abs < 0.8) return "MODERATE";
  if (abs < 1.5) return "STRONG";
  return "EXPANSION";
}

// Momentum acceleration: compare recent momentum vs prior momentum
function momentumAcceleration(closes: number[]): number {
  if (closes.length < 9) return 0;
  // Recent 3-candle move vs prior 3-candle move
  const recent = closes.slice(-3);
  const mid = closes.slice(-6, -3);
  const recentMove = (recent[2] - recent[0]) / recent[0] * 100;
  const priorMove = (mid[2] - mid[0]) / mid[0] * 100;
  // Acceleration = change in momentum (positive = accelerating)
  return round(recentMove - priorMove);
}

// Weighted OI momentum: recent periods weighted more heavily
function weightedOiMomentum(oiHistory: any[]): number {
  if (oiHistory.length < 4) return 0;
  const values = oiHistory.map((o: any) => Number(o.openInterest)).reverse();
  // weights: most recent = highest weight
  const weights = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5];
  let wSum = 0;
  let wTotal = 0;
  for (let i = 1; i < values.length && i < weights.length; i++) {
    const change = values[i] > 0 && values[i - 1] > 0
      ? ((values[i] - values[i - 1]) / values[i - 1]) * 100
      : 0;
    wSum += change * weights[i];
    wTotal += weights[i];
  }
  return wTotal > 0 ? round(wSum / wTotal) : 0;
}

function klinesToCandles(klines: any[]): Candle[] {
  return klines.map((k: any) => ({
    open: Number(k[1]),
    high: Number(k[2]),
    low: Number(k[3]),
    close: Number(k[4]),
    volume: Number(k[5]),
  })).reverse();
}

// --- Dual Scoring ---

interface ScoreInput {
  ema20Dir: EmaDir;
  ema50Dir: EmaDir;
  dailyEmaDir: EmaDir;
  dailyAligned: boolean;
  distEma20: number;
  distEma50: number;
  volVsAvg: number;
  oiSignal: OiSignal;
  oiMomentum: number;
  h4Change: number;
  momentum: MomentumClass;
  momAccel: number;
  funding: number;
  compressionScore: number;
  compressed: boolean;
  breakoutTriggered: boolean;
}

// Confirmation Score: ranks confirmed trends
// Weights: Trend 35%, Momentum 25%, OI 20%, Volume 10%, Funding 10%
export function confirmationScore(i: ScoreInput): number {
  const dir = i.ema20Dir === "UP" ? 1 : i.ema20Dir === "DOWN" ? -1 : 0;
  const aligned = i.ema20Dir === i.ema50Dir && i.ema20Dir !== "FLAT";
  const dailyMatch = i.dailyEmaDir === i.ema20Dir && i.dailyEmaDir !== "FLAT";
  const counterTrend = aligned && i.dailyEmaDir !== "FLAT" && !dailyMatch;

  // Trend (0-100)
  let trend = 0;
  if (aligned) trend += 40;
  else if (i.ema20Dir !== "FLAT") trend += 15;
  if (dailyMatch && i.dailyAligned) trend += 40;
  else if (dailyMatch) trend += 25;
  else if (counterTrend) trend -= 30;
  // Entry quality: closer to EMA = better entry, extended = worse
  const nearest = Math.min(Math.abs(i.distEma20), Math.abs(i.distEma50));
  const pullback = (dir > 0 && i.distEma20 < 0 && i.distEma20 > -2) || (dir < 0 && i.distEma20 > 0 && i.distEma20 < 2);
  if (pullback) trend += 20;
  else if (nearest < 0.5) trend += 20;
  else if (nearest < 1.5) trend += 10;
  else if (nearest < 3) trend += 5;
  else if (nearest < 5) trend -= 10;
  else if (nearest < 8) trend -= 20;
  else if (nearest < 10) trend -= 30;
  else trend -= 40;
  trend = Math.max(0, Math.min(100, trend));

  // Momentum (0-100)
  let mom = 0;
  const h4Match = (dir > 0 && i.h4Change > 0) || (dir < 0 && i.h4Change < 0);
  if (i.momentum === "EXPANSION" && h4Match) mom = 100;
  else if (i.momentum === "STRONG" && h4Match) mom = 75;
  else if (i.momentum === "MODERATE" && h4Match) mom = 50;
  else if (i.momentum === "WEAK" && h4Match) mom = 25;
  else if (!h4Match && i.momentum !== "WEAK") mom = 10; // pullback credit

  // OI (0-100)
  let oi = 0;
  const oiMatch = (dir > 0 && i.oiSignal === "LONGS_OPEN") || (dir < 0 && i.oiSignal === "SHORTS_OPEN");
  const oiAgainst = (dir > 0 && i.oiSignal === "SHORTS_OPEN") || (dir < 0 && i.oiSignal === "LONGS_OPEN");
  if (oiMatch) oi = Math.min(Math.abs(i.oiMomentum) * 30, 100);
  else if (i.oiSignal === "SHORTS_CLOSE" || i.oiSignal === "LONGS_CLOSE") oi = 20;
  if (oiAgainst) oi = Math.max(oi - 30, 0);

  // Volume (0-100)
  const vol = i.volVsAvg > 100 ? 100 : i.volVsAvg > 50 ? 75 : i.volVsAvg > 0 ? 50 : 0;

  // Funding (0-100, 100 = safe)
  const absFR = Math.abs(i.funding);
  const fr = absFR >= 0.001 ? 0 : absFR >= 0.0005 ? 30 : absFR >= 0.0003 ? 60 : 100;

  const score = trend * 0.35 + mom * 0.25 + oi * 0.20 + vol * 0.10 + fr * 0.10;
  return round(score);
}

// Potential Score: ranks setups likely to expand soon
// Weights: Compression 30%, OI Buildup 30%, Volume Expansion 20%, Funding Health 10%, Daily Bias 10%
export function potentialScore(i: ScoreInput): number {
  // Compression (0-100)
  const comp = i.compressionScore;

  // OI Buildup (0-100): gradual OI rise during compression is gold
  let oiBuild = 0;
  const oiRising = i.oiMomentum > 0;
  if (oiRising && i.compressed) oiBuild = Math.min(i.oiMomentum * 40, 100);
  else if (oiRising) oiBuild = Math.min(i.oiMomentum * 20, 60);

  // Volume expansion (0-100): dry-up during compression = energy, expansion = confirmation
  let volExp = 0;
  if (i.compressed && i.volVsAvg < 0) volExp = 60; // dry-up = energy buildup
  else if (i.compressed && i.volVsAvg > 0) volExp = 80; // volume returning = breakout starting
  else if (i.volVsAvg > 50) volExp = 70;
  else if (i.volVsAvg > 0) volExp = 30;
  // Momentum acceleration bonus
  if (i.momAccel > 0.5 && i.compressed) volExp = Math.min(volExp + 20, 100);

  // EMA proximity (0-100): tight to EMA = better R:R for breakout
  const nearest = Math.min(Math.abs(i.distEma20), Math.abs(i.distEma50));
  const ema = nearest < 0.5 ? 100 : nearest < 1 ? 85 : nearest < 2 ? 65 : nearest < 3 ? 40 : nearest < 5 ? 20 : 0;

  // Funding health (0-100)
  const absFR = Math.abs(i.funding);
  const fr = absFR < 0.0003 ? 100 : absFR < 0.0005 ? 60 : absFR < 0.001 ? 30 : 0;

  // Daily bias (0-100)
  let daily = 50; // neutral
  if (i.dailyAligned) daily = 100;
  else if (i.dailyEmaDir !== "FLAT") daily = 70;

  const score = comp * 0.25 + oiBuild * 0.25 + volExp * 0.15 + ema * 0.15 + fr * 0.10 + daily * 0.10;
  return round(score);
}

// --- Market Phase Classification ---

function classifyPhase(i: ScoreInput, confScore: number, potScore: number): MarketPhase {
  const dir = i.ema20Dir === "UP" ? 1 : i.ema20Dir === "DOWN" ? -1 : 0;
  const aligned = i.ema20Dir === i.ema50Dir && i.ema20Dir !== "FLAT";
  const h4Match = (dir > 0 && i.h4Change > 0) || (dir < 0 && i.h4Change < 0);
  const absFR = Math.abs(i.funding);
  const absDist = Math.abs(i.distEma20);

  // Exhaustion: extended + crowded + momentum slowing
  if (absDist > 5 && absFR >= 0.0005 && i.momentum !== "EXPANSION") return "EXHAUSTION";
  if (absDist > 8 && i.volVsAvg < 0) return "EXHAUSTION";
  if (absDist > 10) return "EXHAUSTION";

  // Volatility expansion: breakout triggered + volume surge + momentum
  if (i.breakoutTriggered && i.volVsAvg > 30 && (i.momentum === "STRONG" || i.momentum === "EXPANSION")) {
    return "VOLATILITY_EXPANSION";
  }
  if (i.compressed && i.breakoutTriggered && i.momAccel > 0.3) {
    return "VOLATILITY_EXPANSION";
  }

  // Early breakout: compressed + OI building + funding healthy (no price trigger yet)
  if (i.compressed && i.oiMomentum > 0.5 && absFR < 0.0005) {
    return "EARLY_BREAKOUT";
  }
  if (potScore > 60 && i.compressed) return "EARLY_BREAKOUT";

  // Continuation: aligned + momentum confirms + OI confirms
  if (aligned && h4Match && confScore > 50) return "CONTINUATION";

  // Reversal risk: counter-trend signals
  if (aligned && !h4Match) return "REVERSAL_RISK";

  return "UNCLEAR";
}

// --- Category Assignment ---

function assignCategory(phase: MarketPhase, confScore: number, potScore: number): Category {
  // A: confirmed trends
  if (phase === "CONTINUATION" && confScore > 60) return "A";
  if (phase === "VOLATILITY_EXPANSION" && confScore > 50) return "A";
  // B: breakout watchlist
  if (phase === "EARLY_BREAKOUT") return "B";
  if (phase === "VOLATILITY_EXPANSION") return "B";
  // C: everything else (exhaustion, reversal, unclear)
  return "C";
}

// --- Reason ---

const OI_LABELS: Record<OiSignal, string> = {
  LONGS_OPEN: "longs opening",
  SHORTS_OPEN: "shorts opening",
  SHORTS_CLOSE: "shorts closing",
  LONGS_CLOSE: "longs closing",
  NEUTRAL: "OI flat",
};

export function detectReason(
  phase: MarketPhase,
  i: ScoreInput,
): string {
  const aligned = i.ema20Dir === i.ema50Dir && i.ema20Dir !== "FLAT";
  const dailyMatch = i.dailyEmaDir === i.ema20Dir && i.dailyEmaDir !== "FLAT";
  const oiLabel = OI_LABELS[i.oiSignal];
  const absFR = Math.abs(i.funding);
  const absDist = Math.abs(i.distEma20);
  const entryNote = absDist < 0.5 ? ", at EMA" : absDist > 10 ? ", extremely extended" : absDist > 5 ? ", overextended" : absDist > 3 ? ", extended" : "";

  switch (phase) {
    case "EXHAUSTION":
      if (absFR >= 0.001) return i.funding > 0 ? "Longs crowded, funding extreme — squeeze risk" : "Shorts crowded, funding extreme — squeeze risk";
      if (absDist > 8) return `Price ${absDist.toFixed(1)}% from EMA, vol declining — exhaustion`;
      return `Extended${entryNote}, funding elevated — reversal risk rising`;

    case "VOLATILITY_EXPANSION":
      return `Compression released, vol surge +${i.volVsAvg.toFixed(0)}%, ${i.momentum} momentum, ${oiLabel}`;

    case "EARLY_BREAKOUT":
      return `Compressed (${i.compressionScore}), ${oiLabel}, funding healthy — breakout building`;

    case "CONTINUATION":
      if (dailyMatch && aligned) return `Daily+H4 ${i.ema20Dir}, ${oiLabel}, vol ${i.volVsAvg > 0 ? "above" : "below"} avg${entryNote}`;
      if (aligned) return `H4 ${i.ema20Dir} trend, ${oiLabel}${entryNote}`;
      return `Trend continuing, ${oiLabel}`;

    case "REVERSAL_RISK":
      return `H4 candle against ${i.ema20Dir} trend, ${oiLabel} — instability`;

    default:
      if (i.ema20Dir !== i.ema50Dir) return `EMA20 ${i.ema20Dir} vs EMA50 ${i.ema50Dir} — no edge`;
      return "No strong alignment between indicators";
  }
}

// --- Batch Runner ---

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

// --- Main Analysis ---

async function analyzeCoin(coin: any): Promise<CoinAnalysis | null> {
  try {
    const symbol = coin.symbol;
    const [klines, dailyKlines, oiHistory] = await Promise.all([
      fetchH4Kline(symbol),
      fetchDailyKline(symbol),
      fetchOIHistory(symbol),
    ]);

    // Parse candles (skip current live candle)
    const allCandles = klinesToCandles(klines);
    const candles = allCandles.slice(0, -1);
    const closes = candles.map(c => c.close);
    const volumes = candles.map(c => c.volume);

    if (closes.length < 51) return null;

    // --- Trend ---
    const { ema20Dir, ema50Dir } = analyzeTrend(closes);
    const funding = Number(coin.fundingRate);
    const price = Number(coin.lastPrice);
    const ema20 = calculateEMA(closes, 20);
    const ema50 = calculateEMA(closes, 50);
    const prevEma20 = calculateEMA(closes.slice(0, -1), 20);
    const prevEma50 = calculateEMA(closes.slice(0, -1), 50);
    const distEma20 = round(((price - ema20) / ema20) * 100);
    const distEma50 = round(((price - ema50) / ema50) * 100);

    // EMA convergence
    const gapNow = Math.abs(ema20 - ema50) / ema50 * 100;
    const gapPrev = Math.abs(prevEma20 - prevEma50) / prevEma50 * 100;
    const emaConverging = gapNow < gapPrev && gapNow < 1;

    // --- Daily ---
    const dailyCloses = dailyKlines.map((k: any) => Number(k[4])).reverse();
    const dailyTrend = dailyCloses.length >= 51
      ? analyzeTrend(dailyCloses)
      : dailyCloses.length >= 21
        ? { ema20Dir: analyzeTrend(dailyCloses).ema20Dir, ema50Dir: "FLAT" as EmaDir }
        : { ema20Dir: "FLAT" as EmaDir, ema50Dir: "FLAT" as EmaDir };
    const dailyEmaDir = dailyTrend.ema20Dir;
    const dailyAligned = dailyTrend.ema20Dir === dailyTrend.ema50Dir && dailyTrend.ema20Dir !== "FLAT";

    // --- H4 Change (smoothed 3 vs 3) ---
    const recent3 = closes.slice(-3);
    const prior3 = closes.slice(-6, -3);
    const avgRecent = recent3.reduce((a, b) => a + b, 0) / recent3.length;
    const avgPrior = prior3.reduce((a, b) => a + b, 0) / prior3.length;
    const h4Change = round(((avgRecent - avgPrior) / avgPrior) * 100);
    const momentum = classifyMomentum(h4Change);

    // --- Volume ---
    const last3v = volumes.slice(-3);
    const prior20v = volumes.slice(-23, -3);
    const avgLast3 = last3v.reduce((a, b) => a + b, 0) / last3v.length;
    const avgPrior20 = prior20v.length > 0 ? prior20v.reduce((a, b) => a + b, 0) / prior20v.length : avgLast3;
    const volVsAvg = round(avgPrior20 > 0 ? ((avgLast3 - avgPrior20) / avgPrior20) * 100 : 0, 0);

    // --- OI ---
    let oiChange = 0;
    if (oiHistory.length >= 4) {
      const oiRecent = (Number(oiHistory[0].openInterest) + Number(oiHistory[1].openInterest)) / 2;
      const oiPrior = (Number(oiHistory[2].openInterest) + Number(oiHistory[3].openInterest)) / 2;
      oiChange = round(((oiRecent - oiPrior) / oiPrior) * 100);
    } else if (oiHistory.length >= 2) {
      oiChange = round(((Number(oiHistory[0].openInterest) - Number(oiHistory[1].openInterest)) / Number(oiHistory[1].openInterest)) * 100);
    }
    const oiMomentum = weightedOiMomentum(oiHistory);
    const oiSignal = getOiSignal(oiChange, h4Change);

    // --- Compression (filter false positives: require volume not in deep dry-up or daily trend) ---
    const rawComp = analyzeCompression(candles, closes);
    const compressionValid = volVsAvg > -50 || dailyEmaDir !== "FLAT";
    const compressionScore = compressionValid ? rawComp.compressionScore : 0;
    const compressed = compressionValid && rawComp.compressed;

    // --- Momentum acceleration ---
    const momAccel = momentumAcceleration(closes);

    // --- Breakout trigger: price above highest close of last 10 candles ---
    const lookbackHighs = closes.slice(-11, -1); // prior 10 candles (not including current)
    const localHigh = Math.max(...lookbackHighs);
    const localLow = Math.min(...lookbackHighs);
    const dir = ema20Dir === "UP" ? 1 : ema20Dir === "DOWN" ? -1 : 0;
    const breakoutTriggered = dir > 0
      ? closes[closes.length - 1] > localHigh
      : dir < 0
        ? closes[closes.length - 1] < localLow
        : false;

    // --- Scoring ---
    const input: ScoreInput = {
      ema20Dir, ema50Dir, dailyEmaDir, dailyAligned,
      distEma20, distEma50, volVsAvg,
      oiSignal, oiMomentum, h4Change, momentum, momAccel,
      funding, compressionScore, compressed, breakoutTriggered,
    };

    const confScore = confirmationScore(input);
    const potScore = potentialScore(input);

    // --- Phase & Category ---
    const phase = classifyPhase(input, confScore, potScore);
    const category = assignCategory(phase, confScore, potScore);
    // Score by category: A uses confirmation, B uses potential, C uses max
    const score = round(category === "A" ? confScore : category === "B" ? potScore : Math.max(confScore, potScore));
    const reason = detectReason(phase, input);

    return {
      symbol, ema20Dir, ema50Dir, distEma20, distEma50, emaConverging,
      dailyEmaDir, dailyAligned, volVsAvg, oiChange, oiMomentum, oiSignal,
      h4Change, momentum, funding, compressionScore, compressed,
      confirmationScore: confScore, potentialScore: potScore, score,
      reason, phase, category,
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
