const TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";

export async function sendMessage(text: string): Promise<void> {
	if (!TOKEN || !CHAT_ID) {
		console.warn("[TG] Credentials not set, skipping");
		return;
	}

	const res = await fetch(
		`https://api.telegram.org/bot${TOKEN}/sendMessage`,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				chat_id: CHAT_ID,
				text,
				parse_mode: "Markdown",
				disable_web_page_preview: true,
			}),
		}
	);

	if (!res.ok) {
		console.error("[TG]", await res.text());
	}
}
