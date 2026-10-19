import { getUserId, handler } from "../server/http";
import { prisma } from "../server/prisma";

/** Personer man deler minst én gruppe med, og dermed kan sende direktemelding til. */
export const GET = handler(async (request) => {
	const userId = await getUserId(request);
	return prisma.person.findMany({
		where: {
			id: { not: userId },
			memberships: { some: { group: { memberships: { some: { userId } } } } },
		},
		orderBy: { name: "asc" },
	});
});
