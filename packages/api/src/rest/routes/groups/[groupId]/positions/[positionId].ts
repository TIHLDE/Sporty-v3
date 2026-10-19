import {
	HttpError,
	getUserId,
	handler,
	readJson,
	requireAdminOrParent,
} from "../../../../server/http";
import {
	isDuplicateName,
	parsePositionName,
} from "../../../../server/positions";
import { prisma } from "../../../../server/prisma";

type Params = { groupId: string; positionId: string };

async function findPosition(groupId: string, positionId: string) {
	const position = await prisma.groupPosition.findUnique({
		where: { id: positionId },
	});
	if (!position || position.groupId !== groupId)
		throw new HttpError(404, "Fant ikke posisjonen");
	return position;
}

/** (Admin) Gi posisjonen nytt navn, eller flytt den opp/ned i listen med `move`. */
export const PATCH = handler<Params>(
	async (request, { groupId, positionId }) => {
		const userId = await getUserId(request);
		await requireAdminOrParent(userId, groupId);
		const input = await readJson<{ name?: string; move?: "up" | "down" }>(
			request,
		);
		const position = await findPosition(groupId, positionId);

		if (input.move) {
			const neighbor = await prisma.groupPosition.findFirst({
				where: {
					groupId,
					sortOrder:
						input.move === "up"
							? { lt: position.sortOrder }
							: { gt: position.sortOrder },
				},
				orderBy: { sortOrder: input.move === "up" ? "desc" : "asc" },
			});
			if (neighbor) {
				await prisma.$transaction([
					prisma.groupPosition.update({
						where: { id: position.id },
						data: { sortOrder: neighbor.sortOrder },
					}),
					prisma.groupPosition.update({
						where: { id: neighbor.id },
						data: { sortOrder: position.sortOrder },
					}),
				]);
			}
		}

		if (input.name !== undefined) {
			try {
				await prisma.groupPosition.update({
					where: { id: position.id },
					data: { name: parsePositionName(input.name) },
				});
			} catch (error) {
				if (isDuplicateName(error))
					throw new HttpError(400, "Posisjonen finnes allerede");
				throw error;
			}
		}
		return { ok: true };
	},
);

/** (Admin) Slett posisjonen. Spillerne som hadde den, står uten posisjon etterpå. */
export const DELETE = handler<Params>(
	async (request, { groupId, positionId }) => {
		const userId = await getUserId(request);
		await requireAdminOrParent(userId, groupId);
		await findPosition(groupId, positionId);
		await prisma.groupPosition.delete({ where: { id: positionId } });
		return { ok: true };
	},
);
