<script lang="ts">
  import { onMount } from "svelte";

  import { marketData } from "$lib/stores/market";

  import { fetchTickers, fetchH4Kline, fetchOIHistory } from "$lib/api/bybit";

  import { analyzeTrend, analyzeVolumeTrend } from "$lib/analysis/trend";

  import type { CoinAnalysis } from "$lib/types/market";
  import type { EmaDir, VolumeTrend } from "$lib/analysis/trend";

  function tradeScore(
    ema20Dir: EmaDir,
    ema50Dir: EmaDir,
    volumeTrend: VolumeTrend,
    volEma20Dir: EmaDir,
    volEma50Dir: EmaDir,
    oiChange: number,
    h4Change: number,
  ): number {
    let s = 0;

    // EMA alignment: both same direction = strong trend
    if (ema20Dir === ema50Dir && ema20Dir !== "FLAT") s += 3;
    else if (ema20Dir !== "FLAT") s += 1;

    // Volume trend
    if (volumeTrend === "RISING") s += 2;
    else if (volumeTrend === "FLAT") s += 1;

    // Volume EMA directions
    if (volEma20Dir === "UP") s += 1;
    if (volEma50Dir === "UP") s += 1;

    // OI rising = new money entering
    if (oiChange > 0) s += Math.min(oiChange, 3);

    // H4 momentum magnitude
    s += Math.min(Math.abs(h4Change), 3);

    return Math.round(s * 100) / 100;
  }

  function detectEdge(
    ema20Dir: EmaDir,
    ema50Dir: EmaDir,
    volumeTrend: VolumeTrend,
    oiChange: number,
    h4Change: number,
    funding: number,
  ): { edge: string; reason: string } {
    const absFR = Math.abs(funding);
    const emaAligned = ema20Dir === ema50Dir && ema20Dir !== "FLAT";
    const volOk = volumeTrend !== "FALLING";
    const oiRising = oiChange > 0;
    const frSafe = absFR < 0.01;

    if (absFR >= 0.01) {
      return funding > 0
        ? { edge: "⚠ FR HIGH", reason: "Longs overleveraged, funding too high — long squeeze risk" }
        : { edge: "⚠ FR NEG", reason: "Shorts overleveraged, negative funding — short squeeze risk" };
    }

    if (emaAligned && ema20Dir === "UP" && volOk && oiRising && h4Change > 0 && frSafe) {
      const stars = volumeTrend === "RISING" ? "★★★" : "★★";
      return { edge: `LONG ${stars}`, reason: "EMA aligned UP + H4 green + OI rising + vol confirming + FR safe" };
    }

    if (emaAligned && ema20Dir === "DOWN" && volOk && oiRising && h4Change < 0 && frSafe) {
      const stars = volumeTrend === "RISING" ? "★★★" : "★★";
      return { edge: `SHORT ${stars}`, reason: "EMA aligned DOWN + H4 red + OI rising + vol confirming + FR safe" };
    }

    if (emaAligned && ema20Dir === "UP" && h4Change > 0) {
      if (!oiRising) return { edge: "LONG ★", reason: "EMA UP + H4 green but OI flat — no new money entering" };
      if (!volOk) return { edge: "LONG ★", reason: "EMA UP + H4 green but volume declining — weak conviction" };
    }
    if (emaAligned && ema20Dir === "DOWN" && h4Change < 0) {
      if (!oiRising) return { edge: "SHORT ★", reason: "EMA DOWN + H4 red but OI flat — no new money entering" };
      if (!volOk) return { edge: "SHORT ★", reason: "EMA DOWN + H4 red but volume declining — weak conviction" };
    }

    if (emaAligned && ema20Dir === "UP" && h4Change < 0 && oiRising) {
      return { edge: "DIP BUY", reason: "Uptrend pullback — EMA UP but H4 red, OI rising = dip buy zone" };
    }
    if (emaAligned && ema20Dir === "DOWN" && h4Change > 0 && oiRising) {
      return { edge: "BOUNCE SHORT", reason: "Downtrend bounce — EMA DOWN but H4 green, OI rising = short zone" };
    }

    if (ema20Dir !== ema50Dir) {
      return { edge: "CHOP", reason: `EMA20 ${ema20Dir} vs EMA50 ${ema50Dir} — conflicting signals, no clear direction` };
    }

    return { edge: "WAIT", reason: "No strong alignment between EMA, volume, OI, and price" };
  }

  let loading = true;

  async function loadData() {
    try {
      const tickers = await fetchTickers();

      const results: CoinAnalysis[] = [];

      const MIN_VOLUME = 10_000_000;   // $10M 24h volume
      const MAX_VOLUME = 2_000_000_000; // $2B — skip mega caps (BTC, ETH)
      const MIN_OI = 5_000_000;         // $5M OI — real money in market

      const sorted = tickers
        .filter((t: any) => {
          if (!t.symbol.endsWith("USDT")) return false;
          const vol = Number(t.turnover24h);
          const oi = Number(t.openInterestValue);
          return vol >= MIN_VOLUME && vol <= MAX_VOLUME && oi >= MIN_OI;
        })
        .sort((a: any, b: any) => Number(b.turnover24h) - Number(a.turnover24h));

      for (const coin of sorted) {
        try {
          const symbol = coin.symbol;
          const [klines, oiHistory] = await Promise.all([
            fetchH4Kline(symbol),
            fetchOIHistory(symbol),
          ]);
          const closes = klines.map((k: any) => Number(k[4])).reverse();
          const volumes = klines.map((k: any) => Number(k[5])).reverse();

          if (closes.length < 2) continue;

          const { ema20Dir, ema50Dir } = analyzeTrend(closes);
          const { volumeTrend, volEma20Dir, volEma50Dir } = analyzeVolumeTrend(volumes);
          const funding = Number(coin.fundingRate);
          const prev = closes[closes.length - 2];
          const curr = closes[closes.length - 1];
          const h4Change = ((curr - prev) / prev) * 100;

          let oiChange = 0;
          if (oiHistory.length >= 2) {
            const oiNow = Number(oiHistory[0].openInterest);
            const oiPrev = Number(oiHistory[1].openInterest);
            oiChange = ((oiNow - oiPrev) / oiPrev) * 100;
          }

          const score = tradeScore(ema20Dir, ema50Dir, volumeTrend, volEma20Dir, volEma50Dir, oiChange, h4Change);
          const { edge, reason } = detectEdge(ema20Dir, ema50Dir, volumeTrend, oiChange, h4Change, funding);

          results.push({
            symbol,
            ema20Dir,
            ema50Dir,
            volumeTrend,
            volEma20Dir,
            volEma50Dir,
            oiChange,
            h4Change,
            funding,
            score,
            reason,
          });
        } catch (err) {
          console.error(err);
        }
      }

      results.sort((a, b) => b.score - a.score);
      marketData.set(results);
    } catch (err) {
      console.error(err);
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    loadData();

    const interval = setInterval(loadData, 60000);

    return () => clearInterval(interval);
  });
</script>

<style>
  .scanner { font-family: monospace; max-width: 600px; margin: 0 auto; }
  h1 { font-size: 1rem; padding-bottom: 0.5rem; }
  .coin { padding: 0.5rem 0; }
  .header { display: flex; justify-content: space-between; }
  .symbol { font-weight: bold; }
  .score { opacity: 0.6; }
  .reason { font-size: 0.8rem; opacity: 0.6; padding-top: 0.15rem; }
  .row { display: flex; gap: 1rem; font-size: 0.85rem; opacity: 0.8; }
  .up { color: #22c55e; }
  .down { color: #ef4444; }
  .flat { color: #888; }
</style>

<div class="scanner">
  <h1>H4 Flow Scanner</h1>

  {#if loading}
    <p>Loading...</p>
  {:else}
    {#each $marketData as coin, i}
      <div class="coin">
        <div class="header">
          <span class="symbol">{i + 1}. {coin.symbol}</span>
          <span class="score">{coin.score}</span>
        </div>
        <div class="reason">{coin.reason}</div>
        <div class="row">
          <span>EMA20 <span class={coin.ema20Dir === 'UP' ? 'up' : coin.ema20Dir === 'DOWN' ? 'down' : 'flat'}>{coin.ema20Dir === 'UP' ? '▲' : coin.ema20Dir === 'DOWN' ? '▼' : '—'}</span></span>
          <span>EMA50 <span class={coin.ema50Dir === 'UP' ? 'up' : coin.ema50Dir === 'DOWN' ? 'down' : 'flat'}>{coin.ema50Dir === 'UP' ? '▲' : coin.ema50Dir === 'DOWN' ? '▼' : '—'}</span></span>
          <span class={coin.h4Change >= 0 ? 'up' : 'down'}>H4 {coin.h4Change >= 0 ? '+' : ''}{coin.h4Change.toFixed(2)}%</span>
        </div>
        <div class="row">
          <span>OI <span class={coin.oiChange >= 0 ? 'up' : 'down'}>{coin.oiChange >= 0 ? '+' : ''}{coin.oiChange.toFixed(2)}%</span></span>
          <span>Vol <span class={coin.volumeTrend === 'RISING' ? 'up' : coin.volumeTrend === 'FALLING' ? 'down' : 'flat'}>{coin.volumeTrend === 'RISING' ? '▲' : coin.volumeTrend === 'FALLING' ? '▼' : '—'}</span></span>
          <span>FR <span class={coin.funding >= 0 ? 'up' : 'down'}>{(coin.funding * 100).toFixed(4)}%</span></span>
        </div>
      </div>
    {/each}
  {/if}
</div>
