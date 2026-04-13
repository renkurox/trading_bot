import { db } from "#/db";
import { assetsTable } from "#/db/schema";

export const assetService = {
	async getAssets({ limit, offset }: { limit: number; offset: number }) {
		const assets = await db
			.select({
				symbol: assetsTable.symbol,
			})
			.from(assetsTable)
			.limit(limit)
			.offset(offset);
		return assets;
	},
};
