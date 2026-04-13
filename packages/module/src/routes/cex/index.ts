import { getCoinsByBit } from "#/modules/cex";
import Elysia from "elysia";

export const cex = new Elysia().get("cex", getCoinsByBit);
