<script lang="ts">
  import { Router } from "sv-router";
  import { p } from "sv-router/generated";
</script>

<a href={p("/")}>Home</a>
<a href={p("/market")}>Market</a>

<Router />
