/// <reference types="bun-types" />
export {};

await Bun.build({
	entrypoints: ["./src/index.ts"],
	outdir: "./dist",
	target: "bun",
	minify: true,
	sourcemap: "linked",
});

console.log("Build complete → dist/index.js");
