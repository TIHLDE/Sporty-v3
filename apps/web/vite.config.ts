import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig, loadEnv } from "vite";

// The repo root owns the only .env file.
const envDir = path.join(import.meta.dirname, "../..");

export default defineConfig(({ mode }) => {
	// Make server-side env vars from the root .env available on process.env
	// (Bun's automatic env loading is disabled in bunfig.toml).
	const env = loadEnv(mode, envDir, "");
	for (const [key, value] of Object.entries(env)) {
		process.env[key] ??= value;
	}

	return {
		envDir,
		server: {
			port: 3001,
		},
		resolve: {
			tsconfigPaths: true,
		},
		plugins: [
			tailwindcss(),
			tanstackStart(),
			nitro({ preset: "node-server" }),
			viteReact(),
		],
	};
});
