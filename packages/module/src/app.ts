import { cors } from "@elysiajs/cors";
import { logger } from "@rasla/logify";
import { Elysia } from "elysia";
import { home } from "./routes";
import { asset } from "./routes/assets";
import { health } from "./routes/health";
import { market } from "./routes/market";
import { cex } from "./routes/cex";

const app = new Elysia();

app
	.use(logger())
	.use(
		cors({ origin: ["http://localhost:5173", "https://svely.netlify.app"] }),
	);

app.use(home);
app.use(health);
app.use(asset);
app.use(market);
app.use(cex);

export type ElysiaApp = typeof app;
export default app;
