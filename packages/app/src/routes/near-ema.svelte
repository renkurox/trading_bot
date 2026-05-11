<script lang="ts">
  import { onMount } from "svelte";
  import { fetchTickers, fetchH4Kline } from "$lib/api/bybit";
  import { calculateEMA } from "$lib/analysis/trend";

  interface NearEmaItem {
    symbol: string;
    price: number;
    ema20: number;
    ema50: number;
    distEma20: number;
    distEma50: number;
    nearestEma: "EMA20" | "EMA50";
    nearestDist: number;
  }

  let loading = true;
  let results: NearEmaItem[] = [];

  const NEAR_THRESHOLD = 1; // within 1% of EMA

  async function loadData() {
    try {
      const tickers = await fetchTickers();

      const items: NearEmaItem[] = [];

      const MIN_VOLUME = 10_000_000;
      const MAX_VOLUME = 2_000_000_000;

      const filtered = tickers
        .filter((t: any) => {
          if (!t.symbol.endsWith("USDT")) return false;
          const vol = Number(t.turnover24h);
          return vol >= MIN_VOLUME && vol <= MAX_VOLUME;
        })
        .sort((a: any, b: any) => Number(b.turnover24h) - Number(a.turnover24h));

      for (const coin of filtered) {
        try {
          const symbol = coin.symbol;
          const klines = await fetchH4Kline(symbol);
          const closes = klines.map((k: any) => Number(k[4])).reverse();

          if (closes.length < 50) continue;

          const price = Number(coin.lastPrice);
          const ema20 = calculateEMA(closes, 20);
          const ema50 = calculateEMA(closes, 50);

          const distEma20 = ((price - ema20) / ema20) * 100;
          const distEma50 = ((price - ema50) / ema50) * 100;

          const absEma20 = Math.abs(distEma20);
          const absEma50 = Math.abs(distEma50);

          if (absEma20 > NEAR_THRESHOLD && absEma50 > NEAR_THRESHOLD) continue;

          const nearestEma = absEma20 <= absEma50 ? "EMA20" as const : "EMA50" as const;
          const nearestDist = nearestEma === "EMA20" ? distEma20 : distEma50;

          items.push({
            symbol,
            price,
            ema20,
            ema50,
            distEma20,
            distEma50,
            nearestEma,
            nearestDist,
          });
        } catch (err) {
          console.error(err);
        }
      }

      items.sort((a, b) => {
        if (a.nearestEma !== b.nearestEma) return a.nearestEma === "EMA50" ? -1 : 1;
        return Math.abs(a.nearestDist) - Math.abs(b.nearestDist);
      });
      results = items;
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
  .tag { font-size: 0.75rem; padding: 0.1rem 0.4rem; border-radius: 3px; }
  .tag-ema20 { background: #1e3a5f; color: #60a5fa; }
  .tag-ema50 { background: #3b1f4e; color: #c084fc; }
  .row { display: flex; gap: 1rem; font-size: 0.85rem; opacity: 0.8; }
  .above { color: #22c55e; }
  .below { color: #ef4444; }
</style>

<div class="scanner">
  <h1>Near EMA</h1>

  {#if loading}
    <p>Loading...</p>
  {:else if results.length === 0}
    <p>No coins near EMA right now.</p>
  {:else}
    {#each results as coin, i}
      <div class="coin">
        <div class="header">
          <span class="symbol">
            {i + 1}. {coin.symbol}
            <span class="tag {coin.nearestEma === 'EMA20' ? 'tag-ema20' : 'tag-ema50'}">{coin.nearestEma}</span>
          </span>
          <span class={coin.nearestDist >= 0 ? 'above' : 'below'}>
            {coin.nearestDist >= 0 ? '+' : ''}{coin.nearestDist.toFixed(3)}%
          </span>
        </div>
        <div class="row">
          <span>Price {coin.price.toPrecision(6)}</span>
          <span>EMA20 <span class={coin.distEma20 >= 0 ? 'above' : 'below'}>{coin.distEma20 >= 0 ? '+' : ''}{coin.distEma20.toFixed(3)}%</span></span>
          <span>EMA50 <span class={coin.distEma50 >= 0 ? 'above' : 'below'}>{coin.distEma50 >= 0 ? '+' : ''}{coin.distEma50.toFixed(3)}%</span></span>
        </div>
      </div>
    {/each}
  {/if}
</div>
