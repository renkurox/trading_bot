interface Instrument {
	symbol: string;
	baseCoin: string;
	quoteCoin: string;
	status: string;
	contractType?: string;
}

interface BybitResponse {
	result: {
		list: Instrument[];
		nextPageCursor?: string;
	};
}

const allInstruments: Instrument[] = [];
let cursor = "";

do {
	const url = new URL(
		"https://api.bybit.com/v5/market/instruments-info"
	);

	url.searchParams.set("category", "linear");
	url.searchParams.set("limit", "1000");

	if (cursor) {
		url.searchParams.set("cursor", cursor);
	}

	const response = await fetch(url);

	if (!response.ok) {
		throw new Error("Failed to fetch");
	}

	const data: BybitResponse = await response.json();

	allInstruments.push(...data.result.list);

	cursor = data.result.nextPageCursor || "";
} while (cursor);

const usdtLinearTopics = allInstruments
	.filter(
		(coin) =>
			coin.quoteCoin === "USDT" &&
			coin.status === "Trading" &&
			coin.contractType === "LinearPerpetual"
	)
	.map((coin) => `kline.60.${coin.symbol}`);

await Bun.write(
	"src/topics.ts",
	`export const topics = ${JSON.stringify(
		usdtLinearTopics,
		null,
		2
	)} as const;\n`
);

console.log(`Generated ${usdtLinearTopics.length} topics`);

export {};