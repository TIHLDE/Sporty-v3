import {
	HttpError,
	canManageGroup,
	getUserId,
	handler,
	readJson,
	requireAccess,
	requireManagerOrParent,
} from "../../../../server/http";
import {
	getMatchFactsGroup,
	requireMatch,
	toMatchFacts,
} from "../../../../server/match-facts";
import { prisma } from "../../../../server/prisma";
import type { MatchFacts } from "../../../../types";

/** Kampfakta for kampen: hendelsestypene til laget og hendelsene som er registrert. */
export const GET = handler<{ eventId: string }>(
	async (request, { eventId }): Promise<MatchFacts> => {
		const userId = await getUserId(request);
		const event = await requireMatch(eventId);
		await requireAccess(userId, event.groupId);
		return toMatchFacts(event, await canManageGroup(userId, event.groupId));
	},
);

/** (Sub-/admin) Registrer en hendelse, f.eks. at en spiller scoret, på en kamp som har startet. */
export const POST = handler<{ eventId: string }>(
	async (request, { eventId }): Promise<MatchFacts> => {
		const userId = await getUserId(request);
		const event = await requireMatch(eventId);
		await requireManagerOrParent(userId, event.groupId);
		if (event.startsAt > new Date())
			throw new HttpError(400, "Kampen har ikke startet ennå");

		const input = await readJson<{ typeId: string; userId: string }>(request);
		const group = await getMatchFactsGroup(event.groupId);
		if (!group.usesMatchFacts)
			throw new HttpError(400, "Kampfakta er skrudd av for laget");
		if (!group.matchStatTypes.some((t) => t.id === input.typeId))
			throw new HttpError(400, "Ukjent hendelse");
		const member = await prisma.membership.findUnique({
			where: {
				userId_groupId: { userId: input.userId, groupId: event.groupId },
			},
		});
		if (!member) throw new HttpError(400, "Spilleren er ikke med i gruppen");

		await prisma.matchStat.create({
			data: { eventId, typeId: input.typeId, userId: input.userId },
		});
		return toMatchFacts(event, true);
	},
);
