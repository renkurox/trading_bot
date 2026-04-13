import { t } from "elysia";

export namespace CoinModel {
	export const query = t.Object({
		page: t.Numeric({ minimum: 1, default: 1 }),
		limit: t.Numeric({ minimum: 1, maximum: 100, default: 20 }),
	});

	export type query = typeof query.static;
}
