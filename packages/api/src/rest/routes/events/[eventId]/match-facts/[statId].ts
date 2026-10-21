import {
	HttpError,
	getUserId,
	handler,
	requireManagerOrParent,
} from "../../../../server/http";
import { requireMatch, toMatchFacts } from "../../../../server/match-facts";
import { prisma } from "../../../../server/prisma";
import type { MatchFacts } from "../../../../types";

/** (Sub-/admin) Fjern en hendelse som er registrert feil. */
export const DELETE = handler<{ eventId: string; statId: string }>(
	async (request, { eventId, statId }): Promise<MatchFacts> => {
		const userId = await getUserId(request);
		const event = await requireMatch(eventId);
		await requireManagerOrParent(userId, event.groupId);
		const stat = await prisma.matchStat.findUnique({ where: { id: statId } });
		if (!stat || stat.eventId !== eventId)
			throw new HttpError(404, "Fant ikke hendelsen");
		await prisma.matchStat.delete({ where: { id: statId } });
		return toMatchFacts(event, true);
	},
);
