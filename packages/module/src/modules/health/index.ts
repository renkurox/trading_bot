import { formatUptime } from "./service";

export const healthCheck = () => ({
	status: "ok",
	uptime: formatUptime(process.uptime()),
});
