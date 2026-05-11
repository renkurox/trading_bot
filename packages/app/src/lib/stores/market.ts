import { writable } from "svelte/store";

import type { CoinAnalysis } from "$lib/types/market";

export const marketData = writable<CoinAnalysis[]>([]);