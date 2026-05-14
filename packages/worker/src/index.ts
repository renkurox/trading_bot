import { scanMarket } from "@tb/sdk";
import type { CoinAnalysis } from "@tb/sdk";

interface Env {
	TELEGRAM_BOT_TOKEN: string;
	TELEGRAM_CHAT_ID: string;
}

function fmt(n: number): string {
	const s = n.toFixed(2);
	return n >= 0 ? `+${s}` : s;
}

function formatCoin(coin: CoinAnalysis): string {
	const dir = coin.ema20Dir === "UP" ? "LONG" : "SHORT";
	const daily = coin.dailyEmaDir === "UP" ? "Daily UP" : coin.dailyEmaDir === "DOWN" ? "Daily DOWN" : "Daily FLAT";
	const comp = coin.compressed ? `  Compressed ${coin.compressionScore}/100` : "";
	const oiLabel = coin.oiSignal === "LONGS_OPEN" ? "Longs opening" : coin.oiSignal === "SHORTS_OPEN" ? "Shorts opening" : coin.oiSignal === "SHORTS_CLOSE" ? "Shorts closing" : coin.oiSignal === "LONGS_CLOSE" ? "Longs closing" : "OI flat";

	return [
		`${coin.symbol}  ${dir}  ${coin.phase}`,
		`Confirm: ${coin.confirmationScore}  Potential: ${coin.potentialScore}`,
		coin.reason,
		`EMA20 ${fmt(coin.distEma20)}%  EMA50 ${fmt(coin.distEma50)}%  H4 ${fmt(coin.h4Change)}% ${coin.momentum}${comp}`,
		`${daily}  OI ${fmt(coin.oiChange)}% ${oiLabel}  Vol ${fmt(coin.volVsAvg)}%  FR ${(coin.funding * 100).toFixed(4)}%`,
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
	// Only Category A (confirmed) or B (breakout)
	if (c.category === "C") return false;
	// Skip bad phases
	if (c.phase === "REVERSAL_RISK" || c.phase === "UNCLEAR" || c.phase === "EXHAUSTION") return false;
	// Not overextended
	if (Math.abs(c.distEma50) > 5) return false;
	// Category A: strong confirmed trend
	if (c.category === "A") {
		if (c.confirmationScore < 60) return false;
		if (c.volVsAvg <= 0) return false;
		if (c.oiSignal === "NEUTRAL") return false;
	}
	// Category B: high potential breakout
	if (c.category === "B") {
		if (c.potentialScore < 55) return false;
		if (!c.compressed) return false;
	}
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

	console.log(`Sent best setup: ${good[0].symbol} (${good[0].score}) [${good[0].category}]`);
}

export default {
	async fetch(req: Request, env: Env): Promise<Response> {
		const url = new URL(req.url);
		if (url.pathname === "/__scheduled") {
			await runScan(env);
			return new Response("OK");
		}
		return new Response("H4 Scanner Worker V2. Use /__scheduled to trigger manually.");
	},

	async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
		await runScan(env);
	},
} satisfies ExportedHandler<Env>;
