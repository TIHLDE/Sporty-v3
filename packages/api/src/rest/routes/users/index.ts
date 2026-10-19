import { HttpError, getUserId, handler } from "../../server/http";
import { prisma } from "../../server/prisma";

/** (Kun utvikling) Alle brukere, for «Bytt bruker» på Profil. Krever ALLOW_DEV_USER_SWITCH=true. */
export const GET = handler(async (request) => {
	await getUserId(request);
	if (process.env.ALLOW_DEV_USER_SWITCH !== "true") {
		throw new HttpError(403, "Bytt bruker er slått av på serveren");
	}
	return prisma.person.findMany({ orderBy: { name: "asc" } });
});
