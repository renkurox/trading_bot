import path from "node:path";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { router } from "sv-router/vite-plugin";
import { defineConfig } from "vite";
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
	plugins: [tailwindcss(), svelte(), router({ allLazy: true })],
	resolve: {
		alias: [
			{ find: /^\$(.+)/, replacement: path.resolve("./src") + "/$1" },
		],
	},
});