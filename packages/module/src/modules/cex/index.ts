import type { CoinFlowInfo, FlowCoin, FlowQuality, FlowState } from "#/types";
import { bybitService } from "./service";

function classifyFlow(c: FlowCoin): FlowState {
	const ratio = c.turnover24h / c.openInterestValue;

	if (ratio >= 3) return "TREND";
	if (ratio >= 1.2) return "HEALTHY";
	if (ratio >= 0.8) return "STUCK";
	return "SQUEEZE_RISK";
}

function enrichFlow(c: FlowCoin) {
	const ratio = c.turnover24h / c.openInterestValue;
	const flowState = classifyFlow(c);

	const meta = {
		TREND: {
			nature: "Dòng tiền xoay vòng mạnh, có tiền thật tham gia",
			action: "Trade theo xu hướng, ưu tiên continuation, tránh bắt đỉnh đáy",
		},
		HEALTHY: {
			nature: "Dòng tiền ổn định, đang trong giai đoạn tích lũy",
			action: "Theo dõi chờ breakout rõ ràng",
		},
		STUCK: {
			nature: "Tiền bị kẹt trong vị thế, thanh khoản động thấp",
			action: "Chỉ quan sát, không nên trade theo trend",
		},
		SQUEEZE_RISK: {
			nature: "Đòn bẩy cao, thanh khoản kém, dễ xảy ra squeeze",
			action: "Tránh trade hoặc chỉ đánh squeeze nếu có kinh nghiệm",
		},
	}[flowState];

	return {
		...c,
		ratio: Number(ratio.toFixed(2)),
		flowState,
		nature: meta.nature,
		action: meta.action,
	};
}

const FLOW_RULES = {
	TURNOVER_MIN: 25_000_000,
	OI_MIN: 8_000_000,
} as const;

function hasMoney(c: FlowCoin): boolean {
	return (
		c.turnover24h >= FLOW_RULES.TURNOVER_MIN &&
		c.openInterestValue >= FLOW_RULES.OI_MIN
	);
}

function flowQuality(vd: number, oi: number): FlowQuality {
	if (vd >= 20 && oi >= 1.5) return "STRONG";
	if (vd >= 10 && oi > 0) return "OK";

	return "WEAK";
}

export const getCoinsByBit = async (): Promise<CoinFlowInfo[]> => {
	const coins = (await bybitService.getCoins()).filter(hasMoney);

	const results: CoinFlowInfo[] = [];

	for (const c of coins) {
		const [emaH4, oiH4, oiH1, flowH4, flowH1, volDevH4, volDevH1] =
			await Promise.all([
				bybitService.emaBiasH4(c.symbol),
				bybitService.oi(c.symbol, "4h"),
				bybitService.oi(c.symbol, "1h"),
				bybitService.priceFlow(c.symbol, 240),
				bybitService.priceFlow(c.symbol, 60),
				bybitService.volumeDeviation(c.symbol, 240),
				bybitService.volumeDeviation(c.symbol, 60),
			]);

		const flowState = enrichFlow(c);

		results.push({
			...c,
			...flowState,
			emaH4,
			oiChangeH4: oiH4.pct,
			oiChangeH1: oiH1.pct,
			volumeDeviationH4: volDevH4,
			volumeDeviationH1: volDevH1,
			momentumPctH4: flowH4.momentumPct,
			controlH4: flowH4.control,
			momentumPctH1: flowH1.momentumPct,
			controlH1: flowH1.control,
		});
	}
	return results.sort((a, b) => b.volumeDeviationH4 - a.volumeDeviationH4);
};
