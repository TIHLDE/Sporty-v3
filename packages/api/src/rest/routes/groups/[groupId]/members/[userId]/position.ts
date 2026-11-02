import {
	HttpError,
	getUserId,
	handler,
	readJson,
	requireManagerOrParent,
	requireMember,
} from "../../../../../server/http";
import { prisma } from "../../../../../server/prisma";

/**
 * Sett posisjonen til et medlem, fra gruppens posisjonsliste. `null` fjerner den. Medlemmet kan
 * velge sin egen, sub-/admin kan sette den for alle.
 */
export const PUT = handler<{ groupId: string; userId: string }>(
	async (request, { groupId, userId: memberId }) => {
		const userId = await getUserId(request);
		if (memberId === userId) await requireMember(userId, groupId);
		else await requireManagerOrParent(userId, groupId);
		const { positionId } = await readJson<{ positionId: string | null }>(
			request,
		);

		const group = await prisma.group.findUniqueOrThrow({
			where: { id: groupId },
		});
		if (!group.usesPositions)
			throw new HttpError(400, "Gruppen bruker ikke posisjoner");
		if (positionId !== null) {
			const position = await prisma.groupPosition.findUnique({
				where: { id: positionId },
			});
			if (!position || position.groupId !== groupId)
				throw new HttpError(400, "Ugyldig posisjon");
		}

		const updated = await prisma.membership.updateMany({
			where: { groupId, userId: memberId },
			data: { positionId },
		});
		if (updated.count === 0)
			throw new HttpError(404, "Brukeren er ikke medlem av gruppen");
		return { positionId };
	},
);
