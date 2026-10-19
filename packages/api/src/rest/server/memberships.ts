// Felles for alle steder der noen fjernes fra en gruppe. Kun serverkode.

import { upcomingEventsWhere } from "./dto";
import { prisma } from "./prisma";

/**
 * Fjerner brukerne fra gruppen og fra alt under den: undergruppene, svarene på kommende
 * arrangementer og varslene derfra. Da mister de også tilgang til chat, avstemninger, filer osv.,
 * som alle krever medlemskap. Historikk som bøter, betalinger og tidligere oppmøte beholdes.
 */
export async function removeFromGroup(groupId: string, userIds: string[]) {
	if (userIds.length === 0) return;
	const subgroups = await prisma.group.findMany({
		where: { parentId: groupId },
		select: { id: true },
	});
	const groupIds = [groupId, ...subgroups.map((g) => g.id)];

	await prisma.$transaction([
		prisma.attendance.deleteMany({
			where: {
				userId: { in: userIds },
				event: { groupId: { in: groupIds }, ...upcomingEventsWhere() },
			},
		}),
		prisma.notification.deleteMany({
			where: { userId: { in: userIds }, groupId: { in: groupIds } },
		}),
		prisma.conversationMember.deleteMany({
			where: {
				userId: { in: userIds },
				conversation: { groupId: { in: groupIds } },
			},
		}),
		prisma.membership.deleteMany({
			where: { userId: { in: userIds }, groupId: { in: groupIds } },
		}),
	]);
}
