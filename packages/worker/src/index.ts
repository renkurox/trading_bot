import { scanMarket } from "@tb/sdk";
import type { CoinAnalysis } from "@tb/sdk";

interface Env {
	TELEGRAM_BOT_TOKEN: string;
	TELEGRAM_CHAT_ID: string;
}

const MIN_SCORE = 10;

function fmt(n: number): string {
	const s = n.toFixed(2);
	return n >= 0 ? `+${s}` : s;
}

function formatCoin(coin: CoinAnalysis): string {
	const dir = coin.ema20Dir === "UP" ? "LONG" : "SHORT";
	const d = coin.dailyEmaDir === "UP" ? "▲" : coin.dailyEmaDir === "DOWN" ? "▼" : "—";
	const sq = coin.emaConverging ? " SQUEEZE" : "";
	const oiTag = coin.oiSignal === "LONGS_OPEN" ? "L↑" : coin.oiSignal === "SHORTS_OPEN" ? "S↑" : coin.oiSignal === "SHORTS_CLOSE" ? "S↓" : coin.oiSignal === "LONGS_CLOSE" ? "L↓" : "";

	return [
		`${coin.symbol}  ${dir}  ${coin.score}`,
		coin.reason,
		`EMA20 ${fmt(coin.distEma20)}%  EMA50 ${fmt(coin.distEma50)}%  H4 ${fmt(coin.h4Change)}%${sq}`,
		`D ${d}  OI ${fmt(coin.oiChange)}% ${oiTag}  Vol ${fmt(coin.volVsAvg)}%  FR ${(coin.funding * 100).toFixed(4)}%`,
	].join("\n");
}

async function sendTelegram(token: string, chatId: string, text: string): Promise<void> {
	const url = `https://api.telegram.org/bot${token}/sendMessage`;
	const res = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			chat_id: chatId,
			text,
			parse_mode: "Markdown",
			disable_web_page_preview: true,
		}),
	});
	if (!res.ok) {
		const err = await res.text();
		console.error("Telegram error:", err);
	}
}

function isGoodSetup(c: CoinAnalysis): boolean {
	if (c.score < MIN_SCORE) return false;
	if (c.tradeType === "REVERSAL_RISK" || c.tradeType === "UNCLEAR") return false;
	if (c.dailyEmaDir !== "FLAT" && c.dailyEmaDir !== c.ema20Dir) return false;
	if (Math.abs(c.distEma20) > 5) return false;
	if (c.volVsAvg <= 0) return false;
	if (c.oiSignal === "NEUTRAL") return false;
	return true;
}

const SCAN_LIMIT = 15;

async function runScan(env: Env): Promise<void> {
	console.log(`Scan triggered at ${new Date().toISOString()}`);

	const results = await scanMarket(SCAN_LIMIT);
	const good = results.filter(isGoodSetup);

	if (good.length === 0) {
		console.log("No good setups found");
		return;
	}

	await sendTelegram(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID, formatCoin(good[0]));

	console.log(`Sent best setup: ${good[0].symbol} (${good[0].score})`);
}

export default {
	async fetch(req: Request, env: Env): Promise<Response> {
		const url = new URL(req.url);
		if (url.pathname === "/__scheduled") {
			await runScan(env);
			return new Response("OK");
		}
		return new Response("H4 Scanner Worker. Use /__scheduled to trigger manually.");
	},

	async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
		await runScan(env);
	},
} satisfies ExportedHandler<Env>;
