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

export const messageInclude = { sender: true } satisfies Prisma.MessageInclude;

export function toMessage(
	message: Prisma.MessageGetPayload<{ include: typeof messageInclude }>,
): Dto.Message {
	return {
		id: message.id,
		conversationId: message.conversationId,
		sender: toUser(message.sender),
		body: message.body,
		sentAt: message.sentAt.toISOString(),
	};
}
