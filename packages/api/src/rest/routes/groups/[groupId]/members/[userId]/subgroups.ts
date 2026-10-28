import {
	HttpError,
	getUserId,
	handler,
	readJson,
	requireAdminOrParent,
} from "../../../../../server/http";
import { removeFromGroup } from "../../../../../server/memberships";
import { prisma } from "../../../../../server/prisma";

/**
 * (Admin) Bestem hvilke undergrupper et medlem av hovedgruppen er med i. Nye undergrupper gir rollen
 * member. Undergrupper som tas bort fjerner medlemmet fra alt i dem, som når admin velger
 * medlemmer fra undergruppens side.
 */
export const PUT = handler<{ groupId: string; userId: string }>(
	async (request, { groupId, userId: memberId }) => {
		const userId = await getUserId(request);
		await requireAdminOrParent(userId, groupId);
		const { subgroupIds } = await readJson<{ subgroupIds: string[] }>(request);
		if (!Array.isArray(subgroupIds))
			throw new HttpError(400, "Mangler subgroupIds");

		const group = await prisma.group.findUniqueOrThrow({
			where: { id: groupId },
			include: {
				subgroups: {
					select: { id: true, memberships: { where: { userId: memberId } } },
				},
			},
		});
		if (group.parentId)
			throw new HttpError(400, "Undergrupper velges fra hovedgruppen");
		const member = await prisma.membership.findUnique({
			where: { userId_groupId: { userId: memberId, groupId } },
		});
		if (!member) throw new HttpError(404, "Brukeren er ikke medlem av gruppen");

		const wanted = new Set(subgroupIds);
		const known = new Set(group.subgroups.map((s) => s.id));
		if ([...wanted].some((id) => !known.has(id)))
			throw new HttpError(400, "Ukjent undergruppe");

		for (const subgroup of group.subgroups) {
			const isIn = subgroup.memberships.length > 0;
			if (wanted.has(subgroup.id) && !isIn) {
				await prisma.membership.createMany({
					data: [{ userId: memberId, groupId: subgroup.id }],
					skipDuplicates: true,
				});
			} else if (!wanted.has(subgroup.id) && isIn) {
				await removeFromGroup(subgroup.id, [memberId]);
			}
		}
		return { subgroupIds: [...wanted] };
	},
);
