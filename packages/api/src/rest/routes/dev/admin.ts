import { HttpError, getUserId, handler } from "../../server/http";
import { prisma } from "../../server/prisma";

/**
 * (Kun utvikling) Gjør den innloggede brukeren til admin i alle gruppene hen er medlem av,
 * for å teste admin-grensesnittet uten å plyndre databasen for hånd. Sperret i produksjon:
 * Docker-image setter NODE_ENV=production, så ruteren finnes ikke der.
 */
export const POST = handler(async (request) => {
	const userId = await getUserId(request);
	if (process.env.NODE_ENV === "production") {
		throw new HttpError(403, "Bare tilgjengelig i utvikling");
	}
	await prisma.membership.updateMany({
		where: { userId },
		data: { role: "admin" },
	});
	const groups = await prisma.membership.count({ where: { userId } });
	return { groups };
});
