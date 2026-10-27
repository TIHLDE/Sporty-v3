// Gjør om Prisma-rader til DTO-ene appen forventer (src/data/types.ts). Kun serverkode.

import type { Prisma } from "@sporty/db";

import type * as Dto from "../types";
import { isManager } from "./http";
import { prisma } from "./prisma";

export function toGroup(
	group: {
		id: string;
		name: string;
		color: string;
		description: string;
		parentId: string | null;
		usesPositions: boolean;
		coverUploadId: string | null;
		logoUrl: string | null;
	},
	myRole: Dto.Role | null,
): Dto.Group {
	return {
		id: group.id,
		name: group.name,
		color: group.color,
		description: group.description,
		parentId: group.parentId,
		usesPositions: group.usesPositions,
		coverUrl: group.coverUploadId
			? `/api/uploads/${group.coverUploadId}`
			: null,
		logoUrl: group.logoUrl,
		myRole,
	};
}

export const eventInclude = {
	group: {
		select: {
			name: true,
			parentId: true,
			memberships: {
				select: { userId: true, role: true, inactiveSince: true },
			},
			parent: {
				select: { memberships: { select: { userId: true, role: true } } },
			},
		},
	},
	attendances: { select: { userId: true, status: true, reason: true } },
} satisfies Prisma.EventInclude;

type EventRow = Prisma.EventGetPayload<{ include: typeof eventInclude }>;

export function toUser(user: {
	id: string;
	name: string;
	email: string | null;
	imageUrl: string | null;
}): Dto.User {
	return {
		id: user.id,
		name: user.name,
		email: user.email,
		imageUrl: user.imageUrl,
	};
}

export function toEvent(event: EventRow, userId: string): Dto.Event {
	const myRole =
		event.group.memberships.find((m) => m.userId === userId)?.role ?? null;
	const parentRole =
		event.group.parent?.memberships.find((m) => m.userId === userId)?.role ??
		null;
	return {
		id: event.id,
		groupId: event.groupId,
		groupName: event.group.name,
		title: event.title,
		type: event.type,
		opponent: event.opponent,
		description: event.description,
		location: {
			name: event.locationName,
			address: event.locationAddress,
			latitude: event.latitude,
			longitude: event.longitude,
		},
		start: event.startsAt.toISOString(),
		end: event.endsAt?.toISOString() ?? null,
		signupDeadline: event.signupDeadline?.toISOString() ?? null,
		maxAttendees: event.maxAttendees,
		ourScore: event.ourScore,
		theirScore: event.theirScore,
		attendance: Object.fromEntries(
			event.attendances.map((a) => [a.userId, a.status]),
		),
		absenceReasons: Object.fromEntries(
			event.attendances
				.filter((a) => a.status === "kommer_ikke")
				.map((a) => [a.userId, a.reason]),
		),
		// Inaktive medlemmer forventes ikke å svare: de står ikke under «Ikke svart», får ikke
		// påminnelser om svarfristen og får ikke fellesbot.
		memberIds: event.group.memberships
			.filter((m) => !m.inactiveSince)
			.map((m) => m.userId),
		// Sub-/admin i hovedgruppen kan også styre arrangementer i undergruppene.
		canManage: isManager(myRole) || isManager(parentRole),
		// Bøter gis alltid i hovedgruppen, så det er rollen der som avgjør.
		canGiveFines: event.group.parentId
			? isManager(parentRole)
			: isManager(myRole),
		collectiveFineGiven: event.collectiveFineAt !== null,
	};
}

export function toUpload(u: {
	id: string;
	kind: Dto.UploadedFile["kind"];
	fileName: string;
	mimeType: string;
	sizeBytes: number;
}): Dto.UploadedFile {
	return {
		id: u.id,
		kind: u.kind,
		fileName: u.fileName,
		mimeType: u.mimeType,
		sizeBytes: u.sizeBytes,
		url: `/api/uploads/${u.id}`,
	};
}

export const announcementInclude = {
	group: { select: { name: true, color: true } },
	author: { select: { name: true } },
	uploads: { orderBy: { position: "asc" } },
	_count: { select: { comments: true } },
} satisfies Prisma.AnnouncementInclude;

export function toAnnouncement(
	a: Prisma.AnnouncementGetPayload<{ include: typeof announcementInclude }>,
): Dto.Announcement {
	return {
		id: a.id,
		groupId: a.groupId,
		groupName: a.group.name,
		groupColor: a.group.color,
		authorName: a.author.name,
		title: a.title,
		body: a.body,
		createdAt: a.createdAt.toISOString(),
		allowComments: a.allowComments,
		commentCount: a._count.comments,
		media: a.uploads.filter((u) => u.kind !== "file").map(toUpload),
		attachments: a.uploads.filter((u) => u.kind === "file").map(toUpload),
	};
}

export const pollInclude = {
	options: {
		orderBy: { position: "asc" },
		include: { votes: { select: { userId: true } } },
	},
	createdBy: { select: { name: true } },
	_count: { select: { comments: true } },
} satisfies Prisma.PollInclude;

/** Avstemningen sett fra én bruker: skjulte resultater vises bare for sub-/admin eller etter fristen. */
export function toPoll(
	poll: Prisma.PollGetPayload<{ include: typeof pollInclude }>,
	userId: string,
	myRole: Dto.Role | null,
): Dto.Poll {
	const closed = poll.closesAt < new Date();
	const resultsVisible = !poll.hideVotes || closed || isManager(myRole);
	const voters = new Set(
		poll.options.flatMap((o) => o.votes.map((v) => v.userId)),
	);

	return {
		id: poll.id,
		groupId: poll.groupId,
		question: poll.question,
		description: poll.description,
		createdByName: poll.createdBy?.name ?? null,
		createdAt: poll.createdAt.toISOString(),
		closesAt: poll.closesAt.toISOString(),
		closed,
		allowMultiple: poll.allowMultiple,
		hideVotes: poll.hideVotes,
		allowComments: poll.allowComments,
		commentCount: poll._count.comments,
		options: poll.options.map((o) => ({
			id: o.id,
			label: o.label,
			voteCount: resultsVisible ? o.votes.length : null,
		})),
		myOptionIds: poll.options
			.filter((o) => o.votes.some((v) => v.userId === userId))
			.map((o) => o.id),
		voterCount: resultsVisible ? voters.size : null,
		resultsVisible,
	};
}

export const fineInclude = {
	law: { select: { paragraph: true, title: true } },
	user: true,
	givenBy: { select: { name: true } },
} satisfies Prisma.FineInclude;

export function toFine(
	fine: Prisma.FineGetPayload<{ include: typeof fineInclude }>,
): Dto.Fine {
	return {
		id: fine.id,
		groupId: fine.groupId,
		source: "sporty",
		status: fine.paid ? "paid" : "approved",
		law: fine.law,
		user: toUser(fine.user),
		givenByName: fine.givenBy.name,
		reason: fine.reason,
		count: fine.count,
		imageUrl: fine.imageUri,
		defense: null,
		paid: fine.paid,
		collective: fine.collective,
		createdAt: fine.createdAt.toISOString(),
	};
}

export const paymentInclude = {
	createdBy: { select: { name: true } },
	confirmations: { include: { user: true }, orderBy: { createdAt: "asc" } },
	group: { select: { _count: { select: { memberships: true } } } },
} satisfies Prisma.PaymentRequestInclude;

/** `userId` er den som ser på betalingen, så `myStatus` blir riktig. */
export function toPayment(
	p: Prisma.PaymentRequestGetPayload<{ include: typeof paymentInclude }>,
	userId: string,
	/** Sub-/admin i gruppen eller i hovedgruppen. */
	canManage: boolean,
): Dto.PaymentRequest {
	const count = (status: Dto.PaymentStatus) =>
		p.confirmations.filter((c) => c.status === status).length;
	return {
		id: p.id,
		groupId: p.groupId,
		createdByName: p.createdBy.name,
		title: p.title,
		description: p.description,
		amount: p.amount,
		vippsNumber: p.vippsNumber,
		dueDate: p.dueDate.toISOString(),
		createdAt: p.createdAt.toISOString(),
		myStatus:
			p.confirmations.find((c) => c.userId === userId)?.status ?? "unpaid",
		approvedCount: count("approved"),
		pendingCount: count("pending"),
		memberCount: p.group._count.memberships,
		canManage,
		confirmations: canManage
			? p.confirmations.map((c) => ({
					user: toUser(c.user),
					status: c.status,
					createdAt: c.createdAt.toISOString(),
				}))
			: null,
	};
}

/** Arrangementer som ikke er ferdige: sluttid i fremtiden, eller starttid i fremtiden uten sluttid. */
export function upcomingEventsWhere(now = new Date()): Prisma.EventWhereInput {
	return {
		OR: [{ endsAt: { gte: now } }, { endsAt: null, startsAt: { gte: now } }],
	};
}

export function pastEventsWhere(now = new Date()): Prisma.EventWhereInput {
	return {
		OR: [{ endsAt: { lt: now } }, { endsAt: null, startsAt: { lt: now } }],
	};
}

/** Lager et varsel til hver mottaker. Brukes når noe nytt skjer i en gruppe. */
export async function notify(
	userIds: string[],
	notification: Omit<Prisma.NotificationCreateManyInput, "userId">,
) {
	if (userIds.length === 0) return;
	await prisma.notification.createMany({
		data: userIds.map((userId) => ({ ...notification, userId })),
	});
}
