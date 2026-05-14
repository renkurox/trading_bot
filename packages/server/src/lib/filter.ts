import type { CoinAnalysis } from "@tb/sdk";

export function isGoodSetup(c: CoinAnalysis): boolean {
	if (c.category === "C") return false;
	if (c.phase === "EXHAUSTION" || c.phase === "REVERSAL_RISK") return false;
	if (Math.abs(c.distEma50) > 5) return false;
	if (c.category === "A") return c.confirmationScore >= 60;
	if (c.category === "B") return c.potentialScore >= 55;
	return false;
}
