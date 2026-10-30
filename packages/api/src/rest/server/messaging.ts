// Felles logikk for meldinger. Kun serverkode.
//
// To typer samtaler:
// - Gruppechat: én per gruppe (også undergrupper). Alle medlemmer av gruppen har tilgang, og
//   samtalen lages automatisk første gang noen i gruppen ser på meldingene sine.
// - Direktemelding: to personer, tilgang styres av ConversationMember-radene.

import type { Prisma } from "@sporty/db";

import type * as Dto from "../types";
import { toUser } from "./dto";
import { HttpError, getRole } from "./http";
import { prisma } from "./prisma";

const conversationInclude = {
	group: { select: { id: true, name: true, color: true } },
	members: { include: { user: true } },
} satisfies Prisma.ConversationInclude;

type ConversationRow = Prisma.ConversationGetPayload<{
	include: typeof conversationInclude;
}>;

/** Alle samtalene brukeren har tilgang til. Lager gruppechatter som mangler. */
export async function getMyConversations(userId: string) {
	const memberships = await prisma.membership.findMany({
		where: { userId },
		select: { groupId: true },
	});
	const groupIds = memberships.map((m) => m.groupId);

	await prisma.conversation.createMany({
		data: groupIds.map((groupId) => ({ groupId })),
		skipDuplicates: true,
	});

	return prisma.conversation.findMany({
		where: {
			OR: [
				{ groupId: { in: groupIds } },
				{ groupId: null, members: { some: { userId } } },
			],
		},
		include: conversationInclude,
	});
}

/** Henter samtalen og sjekker at brukeren har tilgang til den. */
export async function requireConversation(
	userId: string,
	conversationId: string,
) {
	const conversation = await prisma.conversation.findUnique({
		where: { id: conversationId },
		include: conversationInclude,
	});
	if (!conversation) throw new HttpError(404, "Fant ikke samtalen");

	const allowed = conversation.groupId
		? (await getRole(userId, conversation.groupId)) !== null
		: conversation.members.some((m) => m.userId === userId);
	if (!allowed) throw new HttpError(403, "Du har ikke tilgang til samtalen");
	return conversation;
}

/**
 * Tidspunktet alle de andre i samtalen har lest frem til, eller null hvis noen ikke har åpnet den.
 * I en gruppechat teller alle medlemmene av gruppen, også de som aldri har åpnet chatten.
 */
export async function othersReadAt(
	conversation: ConversationRow,
	userId: string,
) {
	const others = conversation.groupId
		? (
				await prisma.membership.findMany({
					where: { groupId: conversation.groupId, userId: { not: userId } },
					select: { userId: true },
				})
			).map((m) => m.userId)
		: conversation.members.map((m) => m.userId).filter((id) => id !== userId);
	if (others.length === 0) return null;

	const readAt = new Map(
		conversation.members.map((m) => [m.userId, m.lastReadAt]),
	);
	let earliest: Date | null = null;
	for (const id of others) {
		const at = readAt.get(id);
		if (!at) return null;
		if (!earliest || at < earliest) earliest = at;
	}
	return earliest?.toISOString() ?? null;
}

/** Antall uleste meldinger fra andre siden brukeren sist leste samtalen. */
export function countUnread(conversation: ConversationRow, userId: string) {
	const lastReadAt =
		conversation.members.find((m) => m.userId === userId)?.lastReadAt ?? null;
	return prisma.message.count({
		where: {
			conversationId: conversation.id,
			senderId: { not: userId },
			...(lastReadAt ? { sentAt: { gt: lastReadAt } } : {}),
		},
	});
}

/** Tittel og bilde sett fra brukeren: gruppenavnet, eller navnet til den andre personen. */
export function describeConversation(
	conversation: ConversationRow,
	userId: string,
) {
	const otherUser = conversation.group
		? null
		: (conversation.members.find((m) => m.userId !== userId)?.user ?? null);
	return {
		title:
			conversation.group?.name ??
			otherUser?.name ??
			(conversation.title || "Samtale"),
		group: conversation.group,
		otherUser: otherUser ? toUser(otherUser) : null,
	};
}

export const MAX_MESSAGE_LENGTH = 4000;

export const messageInclude = {
	sender: true,
	replyTo: { include: { sender: { select: { name: true } } } },
	reactions: { include: { user: true }, orderBy: { createdAt: "asc" } },
} satisfies Prisma.MessageInclude;

/** `userId` er den som ser på meldingen, så `mine` blir riktig på reaksjonene. */
export function toMessage(
	message: Prisma.MessageGetPayload<{ include: typeof messageInclude }>,
	userId: string,
): Dto.Message {
	const { replyTo } = message;
	const reactions = new Map<string, Dto.MessageReaction>();
	for (const r of message.reactions) {
		const reaction = reactions.get(r.emoji) ?? {
			emoji: r.emoji,
			count: 0,
			mine: false,
			users: [],
		};
		reaction.count++;
		reaction.mine ||= r.userId === userId;
		reaction.users.push(toUser(r.user));
		reactions.set(r.emoji, reaction);
	}
	return {
		id: message.id,
		conversationId: message.conversationId,
		sender: toUser(message.sender),
		body: message.body,
		sentAt: message.sentAt.toISOString(),
		deleted: message.deletedAt !== null,
		edited: message.editedAt !== null,
		replyTo: replyTo
			? {
					id: replyTo.id,
					senderName: replyTo.sender.name,
					body: replyTo.body,
					deleted: replyTo.deletedAt !== null,
				}
			: null,
		reactions: message.deletedAt ? [] : [...reactions.values()],
	};
}
