// Felles for kampfakta: hendelsestyper (styres av hovedgruppen) og hendelser på kamper. Kun
// serverkode.

import type * as Dto from "../types";
import { toUser } from "./dto";
import { HttpError } from "./http";
import { prisma } from "./prisma";

/** Typene nye hovedgrupper får. Admin kan endre listen etterpå. */
export const DEFAULT_MATCH_STAT_TYPES = [
	"Mål",
	"Assist",
	"Banens beste",
	"Gult kort",
	"Rødt kort",
];

/** Til `create` på en ny hovedgruppe. */
export const defaultMatchStatTypes = {
	create: DEFAULT_MATCH_STAT_TYPES.map((name, sortOrder) => ({
		name,
		sortOrder,
	})),
};

/** Hovedgruppen som styrer kampfakta for gruppen (gruppen selv, eller hovedgruppen til en undergruppe). */
export async function getMatchFactsGroup(groupId: string) {
	const group = await prisma.group.findUnique({
		where: { id: groupId },
		select: { id: true, parentId: true },
	});
	if (!group) throw new HttpError(404, "Fant ikke gruppen");
	return prisma.group.findUniqueOrThrow({
		where: { id: group.parentId ?? group.id },
		select: {
			id: true,
			usesMatchFacts: true,
			matchStatTypes: {
				select: { id: true, name: true },
				orderBy: { sortOrder: "asc" },
			},
		},
	});
}

export async function getGroupMatchFacts(
	groupId: string,
): Promise<Dto.GroupMatchFacts> {
	const group = await getMatchFactsGroup(groupId);
	return {
		enabled: group.usesMatchFacts,
		types: group.matchStatTypes,
		groupId: group.id,
	};
}

/** Kampfakta kan bare endres på hovedgruppen: typene og bryteren gjelder hele laget. */
export async function requireMainGroup(groupId: string) {
	const group = await prisma.group.findUnique({
		where: { id: groupId },
		select: { parentId: true },
	});
	if (!group) throw new HttpError(404, "Fant ikke gruppen");
	if (group.parentId)
		throw new HttpError(400, "Kampfakta styres av hovedgruppen");
}

export function parseMatchStatTypeName(name: unknown) {
	const trimmed = typeof name === "string" ? name.trim() : "";
	if (!trimmed) throw new HttpError(400, "Hendelsen må ha et navn");
	if (trimmed.length > 40)
		throw new HttpError(400, "Navnet kan ha maks 40 tegn");
	return trimmed;
}

export async function listMatchStats(
	eventId: string,
): Promise<Dto.MatchStat[]> {
	const stats = await prisma.matchStat.findMany({
		where: { eventId },
		include: { type: { select: { id: true, name: true } }, user: true },
		orderBy: { createdAt: "asc" },
	});
	return stats.map((s) => ({ id: s.id, type: s.type, user: toUser(s.user) }));
}

/** Kampen, sjekket for at den er en kamp. Kampfakta gjelder kamper som har startet. */
export async function requireMatch(eventId: string) {
	const event = await prisma.event.findUnique({
		where: { id: eventId },
		select: { id: true, groupId: true, type: true, startsAt: true },
	});
	if (!event) throw new HttpError(404, "Fant ikke arrangementet");
	if (event.type !== "kamp")
		throw new HttpError(400, "Kampfakta gjelder bare kamper");
	return event;
}

export async function toMatchFacts(
	event: { id: string; groupId: string },
	canEdit: boolean,
): Promise<Dto.MatchFacts> {
	const [group, stats] = await Promise.all([
		getMatchFactsGroup(event.groupId),
		listMatchStats(event.id),
	]);
	return {
		enabled: group.usesMatchFacts,
		types: group.matchStatTypes,
		stats,
		canEdit,
	};
}
