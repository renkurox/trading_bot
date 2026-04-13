import Elysia from "elysia";
import { binanceService } from "#/modules/cex/service";

export const market = new Elysia({ prefix: "/market" }).get("", async () => {
	const symbols = await binanceService.getAllSymbol();
	return symbols;
});
