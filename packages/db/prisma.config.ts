import { existsSync } from "node:fs";
import path from "node:path";

import { defineConfig, env } from "prisma/config";

// The repo root owns the env file; load it so the Prisma CLI sees DATABASE_URL.
const rootEnvFile = path.join(import.meta.dirname, "../../.env");
if (!process.env.DATABASE_URL && existsSync(rootEnvFile)) {
	process.loadEnvFile(rootEnvFile);
}

export default defineConfig({
	schema: path.join("prisma", "schema"),
	migrations: {
		path: path.join("prisma", "migrations"),
	},
	datasource: {
		url: env("DATABASE_URL"),
	},
});
