interface Instrument {
	symbol: string;
	baseCoin: string;
	quoteCoin: string;
	status: string;
}

interface BybitResponse {
	result: {
		list: Instrument[];
	};
}

const response = await fetch(
	"https://api.bybit.com/v5/market/instruments-info?category=spot"
);

if (!response.ok) {
	throw new Error("Failed to fetch");
}

const data: BybitResponse = await response.json();

const usdtCoins = data.result.list
	.filter((coin) => coin.quoteCoin === "USDT")
	.map((coin) => `kline.60.${coin.symbol}`);

await Bun.write(
  "topics.ts",
  JSON.stringify(usdtCoins, null, 2)
);

export {};

