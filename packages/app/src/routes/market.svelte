<script lang="ts">
  import { onMount } from "svelte";

  import { marketData } from "$lib/stores/market";

  import { fetchTickers, fetchH4Kline, fetchOIHistory } from "$lib/api/bybit";

  import { analyzeTrend } from "$lib/analysis/trend";

  import { analyzeFlow } from "$lib/analysis/flow";

  import type { CoinAnalysis } from "$lib/types/market";

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

          if (closes.length < 2) continue;

          const { trend, ema20, ema50 } = analyzeTrend(closes);
          const price = Number(coin.lastPrice);
          const volume24h = Number(coin.turnover24h);
          const oi = Number(coin.openInterest);
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

          const flow = analyzeFlow(trend, h4Change, oiChange, funding, volume24h);

          if (flow.signal === "SKIP") continue;

          results.push({
            symbol,
            price,
            volume24h,
            oi,
            funding,
            trend,
            ema20,
            ema50,
            signal: flow.signal,
            state: flow.state,
            oiChange,
            score: flow.score,
            h4Change,
            reason: flow.reason,
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

<h1>H4 Flow Scanner</h1>

{#if loading}
  <p>Loading...</p>
{:else}
  <ul>
    {#each $marketData as coin, i}
      <li>
        <strong>{i + 1}. {coin.symbol}</strong> — {coin.signal}
        <div>{coin.trend} | H4: {coin.h4Change.toFixed(2)}% | OI: {coin.oiChange.toFixed(2)}%</div>
        <div>{coin.reason}</div>
      </li>
    {/each}
  </ul>
{/if}
