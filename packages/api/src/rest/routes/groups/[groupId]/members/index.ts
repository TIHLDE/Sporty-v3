import {
	HttpError,
	getUserId,
	handler,
	readJson,
	requireAdminOrParent,
} from "../../../../server/http";
import { removeFromGroup } from "../../../../server/memberships";
import { prisma } from "../../../../server/prisma";

/**
 * (Admin) Bestem hvem som er med i en undergruppe. Bare medlemmer av hovedgruppen kan velges.
 * Nye blir member, de som blir værende beholder rolle og posisjon, og de som tas ut fjernes fra
 * alt i undergruppen.
 */
export const PUT = handler<{ groupId: string }>(
	async (request, { groupId }) => {
		const userId = await getUserId(request);
		await requireAdminOrParent(userId, groupId);
		const { userIds } = await readJson<{ userIds: string[] }>(request);
		if (!Array.isArray(userIds)) throw new HttpError(400, "Mangler userIds");

		const group = await prisma.group.findUniqueOrThrow({
			where: { id: groupId },
		});
		if (!group.parentId) {
			throw new HttpError(
				400,
				"Medlemmene i hovedgruppen hentes fra tihlde.org",
			);
		}

		const wanted = [...new Set(userIds)];
		const inParent = await prisma.membership.count({
			where: { groupId: group.parentId, userId: { in: wanted } },
		});
		if (inParent !== wanted.length)
			throw new HttpError(400, "Alle må være medlemmer av hovedgruppen");

		const current = await prisma.membership.findMany({
			where: { groupId },
			select: { userId: true },
		});
		const removed = current
			.map((m) => m.userId)
			.filter((id) => !wanted.includes(id));
		await removeFromGroup(groupId, removed);
		await prisma.membership.createMany({
			data: wanted.map((id) => ({ userId: id, groupId })),
			skipDuplicates: true,
		});
		return { ok: true };
	},
);
