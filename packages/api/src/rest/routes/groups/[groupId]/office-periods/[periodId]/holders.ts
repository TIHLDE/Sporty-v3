import {
	HttpError,
	getUserId,
	handler,
	readJson,
	requireAdminOrParent,
} from "../../../../../server/http";
import { findPeriod } from "../../../../../server/offices";
import { prisma } from "../../../../../server/prisma";

/**
 * (Admin i hovedgruppen) Hvem som har ett verv i perioden. Erstatter de som var der fra før. Nye
 * personer må være medlemmer av laget; de som allerede står der, kan bli selv om de har sluttet.
 */
export const PUT = handler<{ groupId: string; periodId: string }>(
	async (request, { groupId, periodId }) => {
		const userId = await getUserId(request);
		await requireAdminOrParent(userId, groupId);
		await findPeriod(groupId, periodId);
		const input = await readJson<{ officeId: string; userIds: string[] }>(
			request,
		);
		if (!Array.isArray(input.userIds))
			throw new HttpError(400, "userIds må være en liste");
		const userIds = [...new Set(input.userIds)];

		const office = await prisma.groupOffice.findUnique({
			where: { id: input.officeId },
		});
		if (!office || office.groupId !== groupId)
			throw new HttpError(400, "Ugyldig verv");

		const [members, current] = await Promise.all([
			prisma.membership.findMany({
				where: { groupId, userId: { in: userIds } },
				select: { userId: true },
			}),
			prisma.officeHolder.findMany({
				where: { periodId, officeId: office.id },
				select: { userId: true },
			}),
		]);
		const allowed = new Set([...members, ...current].map((m) => m.userId));
		if (userIds.some((id) => !allowed.has(id)))
			throw new HttpError(400, "Alle må være medlemmer av laget");

		await prisma.$transaction([
			prisma.officeHolder.deleteMany({
				where: { periodId, officeId: office.id },
			}),
			prisma.officeHolder.createMany({
				data: userIds.map((id) => ({
					periodId,
					officeId: office.id,
					userId: id,
				})),
			}),
		]);
		return { ok: true };
	},
);
