await Bun.build({
	entrypoints: ["src/index.ts"],
	target: "bun",
	outdir: "dist",
	plugins: [],
});
