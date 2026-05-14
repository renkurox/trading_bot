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
  .scanner { font-family: monospace; max-width: 640px; margin: 0 auto; }
  h1 { font-size: 1rem; padding-bottom: 0.5rem; }
  .coin { padding: 0.5rem 0; }
  .header { display: flex; justify-content: space-between; align-items: center; }
  .symbol { font-weight: bold; }
  .scores { opacity: 0.6; font-size: 0.85rem; }
  .reason { font-size: 0.8rem; opacity: 0.6; padding-top: 0.15rem; }
  .row { display: flex; gap: 1rem; font-size: 0.85rem; opacity: 0.8; }
  .up { color: #22c55e; }
  .down { color: #ef4444; }
  .flat { color: #888; }
  .badge { font-size: 0.7rem; padding: 0.1rem 0.35rem; border-radius: 2px; }
  .cat-a { color: #22c55e; border: 1px solid #22c55e; }
  .cat-b { color: #f59e0b; border: 1px solid #f59e0b; }
  .cat-c { color: #888; border: 1px solid #666; }
  .phase { opacity: 0.7; font-size: 0.75rem; }
  .compressed { color: #a855f7; border: 1px solid #a855f7; }
</style>

<div class="scanner">
  <h1>H4 Flow Scanner V2</h1>

  {#if loading}
    <p>Loading...</p>
  {:else}
    {#each $marketData as coin, i}
      <div class="coin">
        <div class="header">
          <span>
            <span class="symbol">{i + 1}. {coin.symbol}</span>
            <span class="badge" class:cat-a={coin.category === 'A'} class:cat-b={coin.category === 'B'} class:cat-c={coin.category === 'C'}>{coin.category}</span>
            <span class="phase">{coin.phase}</span>
          </span>
          <span class="scores">C:{coin.confirmationScore} P:{coin.potentialScore}</span>
        </div>
        <div class="reason">{coin.reason}</div>
        <div class="row">
          <span>EMA20 <span class={coin.distEma20 >= 0 ? 'up' : 'down'}>{coin.distEma20 >= 0 ? '+' : ''}{coin.distEma20.toFixed(2)}%</span></span>
          <span>EMA50 <span class={coin.distEma50 >= 0 ? 'up' : 'down'}>{coin.distEma50 >= 0 ? '+' : ''}{coin.distEma50.toFixed(2)}%</span></span>
          <span class={coin.h4Change >= 0 ? 'up' : 'down'}>H4 {coin.h4Change >= 0 ? '+' : ''}{coin.h4Change.toFixed(2)}%</span>
          <span class="flat">{coin.momentum}</span>
          {#if coin.compressed}<span class="badge compressed">CMP:{coin.compressionScore}</span>{/if}
        </div>
        <div class="row">
          <span class={coin.dailyEmaDir === 'UP' ? 'up' : coin.dailyEmaDir === 'DOWN' ? 'down' : 'flat'}>Daily {coin.dailyEmaDir}</span>
          <span>OI <span class={coin.oiChange >= 0 ? 'up' : 'down'}>{coin.oiChange >= 0 ? '+' : ''}{coin.oiChange.toFixed(2)}%</span> <span class={coin.oiSignal.includes('OPEN') ? (coin.oiSignal === 'LONGS_OPEN' ? 'up' : 'down') : 'flat'}>{coin.oiSignal === 'LONGS_OPEN' ? 'Longs opening' : coin.oiSignal === 'SHORTS_OPEN' ? 'Shorts opening' : coin.oiSignal === 'SHORTS_CLOSE' ? 'Shorts closing' : coin.oiSignal === 'LONGS_CLOSE' ? 'Longs closing' : 'Flat'}</span></span>
          <span>Vol <span class={coin.volVsAvg >= 0 ? 'up' : 'down'}>{coin.volVsAvg >= 0 ? '+' : ''}{coin.volVsAvg.toFixed(0)}%</span></span>
          <span>FR <span class={Math.abs(coin.funding) >= 0.0005 ? 'down' : coin.funding >= 0 ? 'up' : 'flat'}>{(coin.funding * 100).toFixed(4)}%</span></span>
        </div>
      </div>
    {/each}
  {/if}
</div>
