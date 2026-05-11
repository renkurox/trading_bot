<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { topics } from "$topics";
  type Row = {
    symbol: string;
    changePercent: string;
  };

  let rows: Row[] = [];
  let positiveRows: Row[] = [];
  let negativeRows: Row[] = [];

  const rowMap = new Map<string, Row>();

  let buffer: Row[] = [];
  let interval: any;
  let ws: WebSocket | null = null;

  onMount(() => {
    ws = new WebSocket("wss://stream.bybit.com/v5/public/linear");

    ws.onopen = () => {
      ws!.send(
        JSON.stringify({
          op: "subscribe",
          args: topics,
        }),
      );
    };

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data as string);
      if (!msg.topic?.startsWith("kline")) return;
      const symbol: string = msg.topic.split(".")[2];
      const candle = msg.data[0];
      const open = parseFloat(candle.open);
      const close = parseFloat(candle.close);
      buffer.push({
        symbol,
        changePercent: (((close - open) / open) * 100).toFixed(2),
      });
    };

    interval = setInterval(() => {
      if (!buffer.length) return;

      for (const msg of buffer) {
        let row = rowMap.get(msg.symbol);

        if (row) {
          row.changePercent = msg.changePercent;
        } else {
          row = {
            symbol: msg.symbol,
            changePercent: msg.changePercent,
          };

          rows.push(row);
          rowMap.set(msg.symbol, row);
        }
      }

      positiveRows = [];
      negativeRows = [];

      for (const row of rows) {
        const value = Number(row.changePercent);

        if (value >= 0) {
          positiveRows.push(row);
        } else if (value < 0) {
          negativeRows.push(row);
        }
      }

      positiveRows.sort(
        (a, b) => Number(b.changePercent) - Number(a.changePercent),
      );

      negativeRows.sort(
        (a, b) => Number(a.changePercent) - Number(b.changePercent),
      );

      rows = rows;
      buffer = [];
    }, 100);
  });

  onDestroy(() => {
    ws?.close();
    clearInterval(interval);
  });
</script>

<style>
  .scanner { font-family: monospace; max-width: 700px; margin: 0 auto; }
  h1 { font-size: 1rem; padding-bottom: 0.5rem; }
  .columns { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
  .col-header { display: flex; justify-content: space-between; padding-bottom: 0.25rem; opacity: 0.5; font-size: 0.8rem; }
  .row { display: flex; justify-content: space-between; padding: 0.15rem 0; font-size: 0.85rem; }
  .symbol { font-weight: bold; }
  .up { color: #22c55e; }
  .down { color: #ef4444; }
</style>

<div class="scanner">
  <h1>Live H4 Change</h1>

  <div class="columns">
    <div>
      <div class="col-header">
        <span class="up">LONG</span>
        <span>{positiveRows.length}</span>
      </div>
      {#each positiveRows as row (row.symbol)}
        <div class="row">
          <span class="symbol">{row.symbol}</span>
          <span class="up">+{row.changePercent}%</span>
        </div>
      {/each}
    </div>

    <div>
      <div class="col-header">
        <span class="down">SHORT</span>
        <span>{negativeRows.length}</span>
      </div>
      {#each negativeRows as row (row.symbol)}
        <div class="row">
          <span class="symbol">{row.symbol}</span>
          <span class="down">{row.changePercent}%</span>
        </div>
      {/each}
    </div>
  </div>
</div>
