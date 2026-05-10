<script lang="ts">
  import { onMount, onDestroy } from "svelte";
    import { topics } from "./topics";
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
      ws!.send(JSON.stringify({
        op: "subscribe",
        args: topics,
      }));
    };

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data as string);
      if (!msg.topic?.startsWith("kline")) return;
      const symbol: string = msg.topic.split(".")[2];
      const candle = msg.data[0];
      const open = parseFloat(candle.open);
      const close = parseFloat(candle.close);
      buffer.push({ symbol, changePercent: (((close - open) / open) * 100).toFixed(2) });
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

<div class="grid grid-cols-2 gap-6">
  <div>
    {#if positiveRows.length > 0}
      <p>{positiveRows.length}</p>
    {/if}
    {#each positiveRows as row (row.symbol)}
      <p class="">
        <span>{row.symbol}</span>
        <span>
          {row.changePercent}%
        </span>
      </p>
    {/each}
  </div>
  <div>
    {#if negativeRows.length > 0}
      <p>{negativeRows.length}</p>
    {/if}
    {#each negativeRows as row (row.symbol)}
      <p class="">
        <span>{row.symbol}</span>
        <span>
          {row.changePercent}%
        </span>
      </p>
    {/each}
  </div>
</div>
