import type { CoinAnalysis } from "@tb/sdk";

function fmt(n: number): string {
	const s = n.toFixed(2);
	return n >= 0 ? `+${s}` : s;
}

export function formatCoin(coin: CoinAnalysis): string {
	const data = {
		symbol: coin.symbol,
		direction: coin.ema20Dir === "UP" ? "LONG" : "SHORT",
		phase: coin.phase,
		category: coin.category,
		confirmation: coin.confirmationScore,
		potential: coin.potentialScore,
		reason: coin.reason,
		ema20: `${fmt(coin.distEma20)}%`,
		ema50: `${fmt(coin.distEma50)}%`,
		h4: `${fmt(coin.h4Change)}%`,
		momentum: coin.momentum,
		daily: coin.dailyEmaDir,
		oi: `${fmt(coin.oiChange)}%`,
		oiSignal: coin.oiSignal,
		volume: `${fmt(coin.volVsAvg)}%`,
		funding: `${(coin.funding * 100).toFixed(4)}%`,
		...(coin.compressed ? { compressed: coin.compressionScore } : {}),
	};
	return "```\n" + JSON.stringify(data, null, 2) + "\n```";
}
