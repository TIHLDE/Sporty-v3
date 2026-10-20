import { getUserId, handler } from "../../server/http";
import { syncFromRequest } from "../../server/photon-sync";
import { prisma } from "../../server/prisma";
import type { Me } from "../../types";

/**
 * Den innloggede brukeren. Synker idrettslagene fra tihlde.org først: med en gang ved første
 * innlogging, deretter høyst hvert andre minutt (appen henter /me ofte).
 */
export const GET = handler(async (request): Promise<Me> => {
	const userId = await getUserId(request);
	await syncFromRequest(request, userId);
	const user = await prisma.person.findUniqueOrThrow({
		where: { id: userId },
		include: {
			memberships: {
				where: { inactiveSince: { not: null } },
				include: { group: { select: { name: true } } },
				orderBy: { inactiveSince: "desc" },
			},
		},
	});
	return {
		id: user.id,
		name: user.name,
		email: user.email,
		imageUrl: user.imageUrl,
		inactiveIn: user.memberships.map((m) => ({
			groupId: m.groupId,
			groupName: m.group.name,
			since: m.inactiveSince!.toISOString(),
			reason: m.inactiveReason ?? "",
		})),
	};
});
