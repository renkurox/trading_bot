import Elysia from "elysia";
import { getAssets, insertAssets } from "#/modules/coin";
import { CoinModel } from "#/modules/coin/model";

export const asset = new Elysia({ prefix: "/assets" })
	.get("", getAssets, { query: CoinModel.query })
	.post("", insertAssets);
