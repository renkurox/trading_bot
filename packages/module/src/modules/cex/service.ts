import axios from "axios";

import type {
	BybitKlineResponse,
	BybitOIResponse,
	BybitTickerResponse,
	EMABias,
	FlowCoin,
	OIChange,
	PriceFlowResult,
} from "#/types";
import { isUSDT, parseCandle, toFlowCoin } from "#/utils";

const bybitRestClient = axios.create({
	baseURL: "https://api.bybit.com",
	timeout: 5000,
});

const binanceRestClient = axios.create({
	baseURL: "https://fapi.binance.com/fapi/v1",
	timeout: 5000,
});

export const bybitService = {
	async getCoins(): Promise<FlowCoin[]> {
		const { data } = await bybitRestClient.get<BybitTickerResponse>(
			"/v5/market/tickers",
			{ params: { category: "linear" } },
		);

		return data.result.list.map(toFlowCoin).filter(isUSDT);
	},

	async priceFlow(symbol: string, interval: number): Promise<PriceFlowResult> {
		const { data } = await bybitRestClient.get<BybitKlineResponse>(
			"/v5/market/kline",
			{
				params: {
					category: "linear",
					symbol,
					interval,
					limit: 2,
				},
			},
		);

		const candles = data.result.list;
		if (!candles || candles.length < 2) {
			return { momentumPct: 0, control: 0 };
		}

		// nến đã đóng gần nhất
		const candle = parseCandle(candles[1]);
		if (!candle) {
			return { momentumPct: 0, control: 0 };
		}

		const { open, high, low, close } = candle;

		// -------- momentum (% change)
		const momentumPct = open !== 0 ? ((close - open) / open) * 100 : 0;

		// -------- control (close nằm ở đâu trong range)
		const range = high - low;
		const control = range !== 0 ? (close - open) / range : 0;

		return {
			momentumPct,
			control,
		};
	},

	async volumeDeviation(symbol: string, interval: number): Promise<number> {
		const { data } = await bybitRestClient.get<BybitKlineResponse>(
			"/v5/market/kline",
			{
				params: {
					category: "linear",
					symbol,
					interval,
					limit: 6,
				},
			},
		);

		const candles = data.result.list;
		if (!candles || candles.length < 6) return 0;

		const CLOSED_INDEX = 1;
		const VOLUME_INDEX = 5;

		const lastClosedVolume = Number(candles[CLOSED_INDEX]?.[VOLUME_INDEX]);

		const previousVolumes = candles
			.slice(2)
			.map((c) => Number(c[VOLUME_INDEX]));

		const averageVolume =
			previousVolumes.reduce((sum, v) => sum + v, 0) / previousVolumes.length;

		if (averageVolume === 0) return 0;

		return ((lastClosedVolume - averageVolume) / averageVolume) * 100;
	},

	async oi(symbol: string, intervalTime: string): Promise<OIChange> {
		const { data } = await bybitRestClient.get<BybitOIResponse>(
			"/v5/market/open-interest",
			{
				params: {
					category: "linear",
					symbol,
					intervalTime,
					limit: 3,
				},
			},
		);

		const list = data.result.list;
		if (!list || list.length < 3) {
			return { pct: 0 };
		}

		const CLOSED_INDEX = 1;
		const PREVIOUS_INDEX = 2;

		const currentOI = Number(list[CLOSED_INDEX]?.openInterest);
		const previousOI = Number(list[PREVIOUS_INDEX]?.openInterest);

		if (previousOI === 0) {
			return { pct: 0 };
		}

		const pctChange = ((currentOI - previousOI) / previousOI) * 100;

		return { pct: pctChange };
	},

	async emaBiasH4(symbol: string): Promise<EMABias> {
		const { data } = await bybitRestClient.get<BybitKlineResponse>(
			"/v5/market/kline",
			{
				params: {
					category: "linear",
					symbol,
					interval: 240,
					limit: 210,
				},
			},
		);

		const candles = data?.result?.list;
		if (!candles || candles.length < 201) return "NEAR";

		const EMA_PERIOD = 200;
		const CLOSE_INDEX = 4;
		const BUFFER = 0.003;

		// lấy 200 nến H4 đã đóng (bỏ nến đang chạy)
		const closes: number[] = [];
		for (let i = 1; i <= EMA_PERIOD; i++) {
			const close = Number(candles[i]?.[CLOSE_INDEX]);
			if (!Number.isFinite(close)) return "NEAR";
			closes.push(close);
		}

		const latestClose = Number(closes[0]);
		const smoothing = 2 / (EMA_PERIOD + 1);

		// EMA bắt đầu từ nến xa nhất
		let ema = closes[closes.length - 1];

		for (let i = closes.length - 2; i >= 0; i--) {
			ema = Number(closes[i]) * smoothing + Number(ema) * (1 - smoothing);
		}

		if (latestClose > Number(ema) * (1 + BUFFER)) return "UP";
		if (latestClose < Number(ema) * (1 - BUFFER)) return "DOWN";
		return "NEAR";
	},
};

export const binanceService = {
	async getAllSymbol() {
		const { data } = await binanceRestClient.get("/exchangeInfo");

		const symbols = data.symbols
			.filter((s: any) => s.contractType === "PERPETUAL")
			.map((s: any) => s.symbol);

		return symbols;
	},
};
