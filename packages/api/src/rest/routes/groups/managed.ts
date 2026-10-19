import { toGroup } from "../../server/dto";
import { getUserId, handler } from "../../server/http";
import { prisma } from "../../server/prisma";

/**
 * Hovedgrupper der brukeren kan gi bøter: Sporty-grupper der hen er sub-/admin, og lag fra
 * tihlde.org med bøter slått på der hen er medlem (der kan alle medlemmer gi bot). Bøter gjelder
 * alltid hele gruppen, så undergrupper er ikke med.
 */
export const GET = handler(async (request) => {
	const userId = await getUserId(request);
	const memberships = await prisma.membership.findMany({
		where: {
			userId,
			group: { parentId: null },
			OR: [
				{ role: { in: ["admin", "subadmin"] }, group: { photonSlug: null } },
				{ group: { photonSlug: { not: null }, photonFinesActivated: true } },
			],
		},
		include: { group: true },
		orderBy: { group: { name: "asc" } },
	});
	return memberships.map((m) => toGroup(m.group, m.role));
});
