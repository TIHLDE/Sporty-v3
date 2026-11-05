// Blokkering og rapportering av meldinger. Kun serverkode.
//
// Rapporter i en gruppechat går til sub-/admin i gruppen og hovedgruppen. Rapporter i en
// direktemelding går til Index, siden ingen gruppe eier samtalen.

import type { Prisma } from "@sporty/db";

import { REPORT_REASONS } from "../lib/messages";
import { reportContent } from "../lib/notification-content";
import type { ReportReason } from "../types";
import { HttpError } from "./http";
import { prisma } from "./prisma";
import { sendPush } from "./push";

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
		senderId: { not: userId },
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

/** Sjekker grunnen fra klienten. */
export function parseReason(reason: unknown): ReportReason {
	const match = REPORT_REASONS.find((r) => r.value === reason);
	if (!match) throw new HttpError(400, "Velg en grunn");
	return match.value;
}

type ReportTarget =
	| { messageId: string }
	| { announcementCommentId: string }
	| { pollCommentId: string };

/**
 * Lagrer rapporten og varsler dem som skal behandle den. Teksten kopieres inn, så den kan vurderes
 * selv om innholdet slettes. Å rapportere det samme to ganger gjør ingenting.
 */
export async function fileReport(report: {
	target: ReportTarget;
	reporterId: string;
	senderId: string;
	groupId: string | null;
	groupName: string | null;
	reason: ReportReason;
	body: string;
	gifUrl?: string | null;
}) {
	const { target, reporterId, senderId, groupId, groupName, reason, body } =
		report;
	if (senderId === reporterId)
		throw new HttpError(400, "Du kan ikke rapportere ditt eget innhold");
	const existing = await prisma.messageReport.findFirst({
		where: { reporterId, ...target },
	});
	if (existing) return;

	await prisma.messageReport.create({
		data: {
			...target,
			reporterId,
			senderId,
			groupId,
			reason,
			body,
			gifUrl: report.gifUrl ?? null,
		},
	});

	const content = reportContent(
		groupName,
		"messageId" in target ? "melding" : "kommentar",
	);
	// Den som er rapportert skal ikke varsles, selv om vedkommende er sub-/admin.
	const moderators = (await moderatorIds(groupId)).filter(
		(id) => id !== senderId && id !== reporterId,
	);
	await prisma.notification.createMany({
		data: moderators.map((id) => ({
			userId: id,
			groupId,
			type: "report" as const,
			text: content.body,
			href: content.url,
		})),
	});
	void sendPush(moderators, "message", content);
}
