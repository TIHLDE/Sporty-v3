// Databasen, delt med resten av serveren (se getDb i @sporty/db). Kun serverkode.
import { getDb } from "@sporty/db";

export const prisma = getDb();
