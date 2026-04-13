import type { Candle, CoinRaw, FlowCoin, KlineRaw } from "#/types";

export function pct(v: number) {
	return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}

export function formatUSD(v: number) {
	if (v >= 1e9) return (v / 1e9).toFixed(2) + "B";
	if (v >= 1e6) return (v / 1e6).toFixed(1) + "M";
	return v.toFixed(0);
}

export const num = (v: string) => Number(v);

export function parseCandle(k?: KlineRaw): Candle | null {
	if (!k) return null;

	const nums = k.map(Number) as [
		number, // timestamp
		number, // open
		number, // high
		number, // low
		number, // close
		number, // volume
		number, // turnover
	];

	const [, open, high, low, close, volume] = nums;

	return { open, high, low, close, volume };
}

export function isUSDT(c: FlowCoin): boolean {
	return c.symbol.endsWith("USDT");
}

export const toFlowCoin = (c: CoinRaw): FlowCoin => ({
	symbol: c.symbol,
	turnover24h: num(c.turnover24h),
	openInterestValue: num(c.openInterestValue),
});
