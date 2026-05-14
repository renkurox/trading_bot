import { scanMarket } from "@tb/sdk";
import { isGoodSetup } from "../lib/filter";
import { formatCoin } from "../lib/format";
import { sendMessage } from "../lib/telegram";

export async function runScan() {
	console.log(`[SCAN] ${new Date().toISOString()}`);

	const results = await scanMarket();
	const good = results.filter(isGoodSetup).slice(0, 5);

	if (good.length === 0) {
		console.log(`[SCAN] No good setups (scanned ${results.length})`);
		return { scanned: results.length, sent: [] };
	}

	for (const coin of good) {
		await sendMessage(formatCoin(coin));
	}

	const sent = good.map((g) => g.symbol);
	console.log(`[SCAN] Sent ${sent.length}: ${sent.join(", ")}`);
	return { scanned: results.length, sent };
}
