import { createId } from "@paralleldrive/cuid2";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const assetsTable = sqliteTable("assets", {
	id: text()
		.primaryKey()
		.$defaultFn(() => createId()),
	symbol: text().notNull().unique(),
});
