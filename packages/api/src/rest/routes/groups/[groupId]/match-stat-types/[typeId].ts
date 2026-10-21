import {
	HttpError,
	getUserId,
	handler,
	readJson,
	requireAdminOrParent,
} from "../../../../server/http";
import {
	parseMatchStatTypeName,
	requireMainGroup,
} from "../../../../server/match-facts";
import { isDuplicateName } from "../../../../server/positions";
import { prisma } from "../../../../server/prisma";

type Params = { groupId: string; typeId: string };

async function findType(userId: string, groupId: string, typeId: string) {
	await requireAdminOrParent(userId, groupId);
	await requireMainGroup(groupId);
	const type = await prisma.matchStatType.findUnique({ where: { id: typeId } });
	if (!type || type.groupId !== groupId)
		throw new HttpError(404, "Fant ikke hendelsen");
	return type;
}

/** (Admin i hovedgruppen) Gi typen nytt navn, eller flytt den opp/ned i listen med `move`. */
export const PATCH = handler<Params>(async (request, { groupId, typeId }) => {
	const userId = await getUserId(request);
	const type = await findType(userId, groupId, typeId);
	const input = await readJson<{ name?: string; move?: "up" | "down" }>(
		request,
	);

	if (input.move) {
		const neighbor = await prisma.matchStatType.findFirst({
			where: {
				groupId,
				sortOrder:
					input.move === "up" ? { lt: type.sortOrder } : { gt: type.sortOrder },
			},
			orderBy: { sortOrder: input.move === "up" ? "desc" : "asc" },
		});
		if (neighbor) {
			await prisma.$transaction([
				prisma.matchStatType.update({
					where: { id: type.id },
					data: { sortOrder: neighbor.sortOrder },
				}),
				prisma.matchStatType.update({
					where: { id: neighbor.id },
					data: { sortOrder: type.sortOrder },
				}),
			]);
		}
	}

	if (input.name !== undefined) {
		try {
			await prisma.matchStatType.update({
				where: { id: type.id },
				data: { name: parseMatchStatTypeName(input.name) },
			});
		} catch (error) {
			if (isDuplicateName(error))
				throw new HttpError(400, "Hendelsen finnes allerede");
			throw error;
		}
	}
	return { ok: true };
});

/** (Admin i hovedgruppen) Slett typen. Hendelsene av denne typen på kampene slettes også. */
export const DELETE = handler<Params>(async (request, { groupId, typeId }) => {
	const userId = await getUserId(request);
	await findType(userId, groupId, typeId);
	await prisma.matchStatType.delete({ where: { id: typeId } });
	return { ok: true };
});
