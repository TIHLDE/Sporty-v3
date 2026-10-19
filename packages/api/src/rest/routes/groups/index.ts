import { toGroup } from "../../server/dto";
import { getUserId, handler } from "../../server/http";
import { syncFromRequest } from "../../server/photon-sync";
import { prisma } from "../../server/prisma";

/**
 * Hovedgruppene brukeren er med i. Synker fra tihlde.org først (høyst hvert andre minutt), så
 * endringer der, f.eks. bøter slått på eller nye medlemmer, kommer med når listen oppdateres.
 */
export const GET = handler(async (request) => {
	const userId = await getUserId(request);
	await syncFromRequest(request, userId);
	const memberships = await prisma.membership.findMany({
		where: { userId, group: { parentId: null } },
		include: { group: true },
		orderBy: { group: { name: "asc" } },
	});
	return memberships.map((m) => toGroup(m.group, m.role));
});
