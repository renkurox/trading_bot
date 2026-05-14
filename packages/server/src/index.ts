import { Elysia } from "elysia";
import { cron } from "@elysiajs/cron";
import { scanMarket } from "@tb/sdk";
import { runScan } from "./jobs/scanner";

const PORT = Number(process.env.PORT || 3001);

const app = new Elysia()
	.use(
		cron({
			name: "scanner",
			pattern: "0 * * * *",
			run: runScan,
		})
	)
	.get("/", () => ({ status: "ok", service: "Trading Scanner V2" }))
	.get("/scan", () => runScan())
	.get("/results", () => scanMarket())
	.listen(PORT);

console.log(`Server running on :${PORT}`);
