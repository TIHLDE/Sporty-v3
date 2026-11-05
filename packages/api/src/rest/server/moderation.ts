// Blokkering og rapportering av meldinger. Kun serverkode.
//
// Rapporter i en gruppechat går til sub-/admin i gruppen og hovedgruppen. Rapporter i en
// direktemelding går til Index, siden ingen gruppe eier samtalen.

import type { Prisma } from "@sporty/db";

import { prisma } from "./prisma";

const MODERATOR_ROLES = ["admin", "subadmin", "index"] as const;

/** Personene `userId` har blokkert. Meldingene deres skjules for `userId`. */
export async function blockedIds(userId: string) {
	const rows = await prisma.userBlock.findMany({
		where: { blockerId: userId },
		select: { blockedId: true },
	});
	return rows.map((row) => row.blockedId);
}

/** De av `userIds` som har blokkert `senderId`, og derfor ikke skal varsles om meldingene. */
export async function blockersOf(senderId: string, userIds: string[]) {
	const rows = await prisma.userBlock.findMany({
		where: { blockedId: senderId, blockerId: { in: userIds } },
		select: { blockerId: true },
	});
	return new Set(rows.map((row) => row.blockerId));
}

/** Om en av de to har blokkert den andre. Da kan de ikke sende direktemeldinger. */
export async function isBlockedEitherWay(a: string, b: string) {
	const count = await prisma.userBlock.count({
		where: {
			OR: [
				{ blockerId: a, blockedId: b },
				{ blockerId: b, blockedId: a },
			],
		},
	});
	return count > 0;
}

/** Rapportene brukeren kan behandle. Ingen kan behandle rapporter om sine egne meldinger. */
export async function moderatedReports(
	userId: string,
): Promise<Prisma.MessageReportWhereInput> {
	const memberships = await prisma.membership.findMany({
		where: { userId, role: { in: [...MODERATOR_ROLES] } },
		select: { groupId: true, role: true },
	});
	const groupIds = memberships.map((m) => m.groupId);
	const subgroups = await prisma.group.findMany({
		where: { parentId: { in: groupIds } },
		select: { id: true },
	});
	const isIndex = memberships.some((m) => m.role === "index");

	return {
		message: { senderId: { not: userId } },
		OR: [
			{ groupId: { in: [...groupIds, ...subgroups.map((g) => g.id)] } },
			...(isIndex ? [{ groupId: null }] : []),
		],
	};
}

/** Hvem som skal varsles om en ny rapport. */
export async function moderatorIds(groupId: string | null) {
	if (!groupId) {
		const rows = await prisma.membership.findMany({
			where: { role: "index" },
			select: { userId: true },
			distinct: ["userId"],
		});
		return rows.map((row) => row.userId);
	}
	const group = await prisma.group.findUniqueOrThrow({
		where: { id: groupId },
		select: { parentId: true },
	});
	const rows = await prisma.membership.findMany({
		where: {
			groupId: { in: [groupId, ...(group.parentId ? [group.parentId] : [])] },
			role: { in: [...MODERATOR_ROLES] },
		},
		select: { userId: true },
		distinct: ["userId"],
	});
	return rows.map((row) => row.userId);
}
