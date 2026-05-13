<script lang="ts">
  import { onMount } from "svelte";
  import { marketData } from "$lib/stores/market";
  import { scanMarket } from "@tb/sdk";

  let loading = true;

  async function loadData() {
    try {
      marketData.set(await scanMarket());
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
  .badge { font-size: 0.75rem; padding: 0.1rem 0.3rem; border-radius: 2px; }
  .badge-converge { color: #f59e0b; border: 1px solid #f59e0b; }
  .badge-daily { opacity: 0.7; }
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
          <span>EMA20 <span class={coin.distEma20 >= 0 ? 'up' : 'down'}>{coin.distEma20 >= 0 ? '+' : ''}{coin.distEma20.toFixed(2)}%</span></span>
          <span>EMA50 <span class={coin.distEma50 >= 0 ? 'up' : 'down'}>{coin.distEma50 >= 0 ? '+' : ''}{coin.distEma50.toFixed(2)}%</span></span>
          <span class={coin.h4Change >= 0 ? 'up' : 'down'}>H4 {coin.h4Change >= 0 ? '+' : ''}{coin.h4Change.toFixed(2)}%</span>
          {#if coin.emaConverging}<span class="badge badge-converge">SQUEEZE</span>{/if}
        </div>
        <div class="row">
          <span class="badge-daily">D <span class={coin.dailyEmaDir === 'UP' ? 'up' : coin.dailyEmaDir === 'DOWN' ? 'down' : 'flat'}>{coin.dailyEmaDir === 'UP' ? '▲' : coin.dailyEmaDir === 'DOWN' ? '▼' : '—'}</span></span>
          <span>OI <span class={coin.oiChange >= 0 ? 'up' : 'down'}>{coin.oiChange >= 0 ? '+' : ''}{coin.oiChange.toFixed(2)}%</span> <span class={coin.oiSignal.includes('OPEN') ? (coin.oiSignal === 'LONGS_OPEN' ? 'up' : 'down') : 'flat'}>{coin.oiSignal === 'LONGS_OPEN' ? 'L↑' : coin.oiSignal === 'SHORTS_OPEN' ? 'S↑' : coin.oiSignal === 'SHORTS_CLOSE' ? 'S↓' : coin.oiSignal === 'LONGS_CLOSE' ? 'L↓' : ''}</span></span>
          <span>Vol <span class={coin.volVsAvg >= 0 ? 'up' : 'down'}>{coin.volVsAvg >= 0 ? '+' : ''}{coin.volVsAvg.toFixed(0)}%</span></span>
          <span>FR <span class={coin.funding >= 0 ? 'up' : 'down'}>{(coin.funding * 100).toFixed(4)}%</span></span>
        </div>
      </div>
    {/each}
  {/if}
</div>
