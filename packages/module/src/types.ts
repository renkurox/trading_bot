export type CoinRaw = {
	symbol: string;
	turnover24h: string;
	openInterestValue: string;
};

export type BybitTickerResponse = {
	retCode: number;
	retMsg: string;
	result: {
		category: string;
		list: CoinRaw[];
	};
};

export type KlineRaw = [
	string, // timestamp
	string, // open
	string, // high
	string, // low
	string, // close
	string, // volume
	string, // turnover
];

export type BybitKlineResponse = {
	retCode: number;
	retMsg: string;
	result: {
		list: KlineRaw[];
	};
};

export type OIRaw = {
	openInterest: string;
};

export type BybitOIResponse = {
	retCode: number;
	retMsg: string;
	result: {
		list: OIRaw[];
	};
};

export type FlowCoin = {
	symbol: string;
	turnover24h: number;
	openInterestValue: number;
};

export type FlowQuality = "STRONG" | "OK" | "WEAK";

export type EMABias = "UP" | "DOWN" | "NEAR";

export type Candle = {
	open: number;
	high: number;
	low: number;
	close: number;
	volume: number;
};

export type CoinFlowInfo = {
	symbol: string;

	// raw data
	turnover24h: number;
	openInterestValue: number;

	// derived
	ratio: number; // turnover / OI
	flowState: FlowState;

	// context
	emaH4: "UP" | "DOWN" | "NEAR";
	oiChangeH4: number;
	oiChangeH1: number;
	volumeDeviationH4: number;
	volumeDeviationH1: number;
	momentumPctH4: number;
	controlH4: number;
	momentumPctH1: number;
	controlH1: number;
};

export type FlowState = "TREND" | "HEALTHY" | "STUCK" | "SQUEEZE_RISK";

export type OIChange = {
	pct: number; // % thay đổi OI H4
};

export type PriceFlowResult = {
	momentumPct: number; // % giá đi được
	control: number; // [-1 → 1] phe kiểm soát nến
};
