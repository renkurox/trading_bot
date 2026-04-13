import type { Context } from "elysia";
import { db } from "#/db";
import { assetsTable } from "#/db/schema";
import { bybitService } from "../cex/service";
import type { CoinModel } from "./model";
import { assetService } from "./service";

type Ctx = Context<{
	query: CoinModel.query;
}>;

export async function getAssets(c: Ctx) {
	const { page, limit } = c.query;
	const offset = (page - 1) * limit;
	const coins = await assetService.getAssets({ limit, offset });
	return {
		data: coins,
	};
}

export async function insertAssets() {
	const coins = await bybitService.getCoins();
	const inserted = await db
		.insert(assetsTable)
		.values(coins)
		.onConflictDoNothing({ target: assetsTable.symbol })
		.returning();
	return inserted;
}
