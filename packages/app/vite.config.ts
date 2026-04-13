import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";
import path from "path";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
	plugins: [tailwindcss(), svelte()],
	resolve: {
		alias: {
			$lib: path.resolve("./src/lib"),
		},
	},
});
