<script lang="ts">
  import { Router } from "sv-router";
  import { p } from "sv-router/generated";
</script>

<a href={p("/")}>Home</a>
<a href={p("/market")}>Market</a>
<a href={p("/near-ema")}>Near EMA</a>

<Router />
