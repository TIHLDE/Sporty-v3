import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../prisma/generated/client";
import type { DatabaseConfig } from "./config";

export type { Prisma } from "../prisma/generated/client";

export function createPrismaClient(env: DatabaseConfig) {
	const adapter = new PrismaPg({
		connectionString: env.DATABASE_URL,
	});
	return new PrismaClient({ adapter });
}

export type Database = ReturnType<typeof createPrismaClient>;

// Én tilkobling for hele serveren. Lagret på globalThis, så den gjenbrukes på tvers av moduler
// og hot reload i utvikling i stedet for å åpne en ny pool hver gang.
const globalForDb = globalThis as unknown as { sportyDb?: Database };

/** Den felles databasetilkoblingen. Brukes av nettsiden (tRPC) og API-et for appen. */
export function getDb(
	env: DatabaseConfig = { DATABASE_URL: process.env.DATABASE_URL ?? "" },
) {
	globalForDb.sportyDb ??= createPrismaClient(env);
	return globalForDb.sportyDb;
}
